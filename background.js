/**
 * Background Event Page - TensorFlow.js Analysis Engine
 * 
 * This background page handles:
 * 1. Loading TensorFlow.js + MobileNet model (loaded as background scripts)
 * 2. Running image analysis via MobileNet inference
 * 3. Coordinating between popup and content script
 * 
 * The model inference runs directly in the background page (not an iframe),
 * which gives it full extension privileges and avoids CSP issues.
 */

// ============================================
// STATE
// ============================================

const engineState = {
  tfReady: false,
  modelReady: false,
  modelLoadAttempted: false,
  mobilenetModel: null,
  analyzing: false,
  initializing: false
};

// ============================================
// INITIALIZATION
// ============================================

async function initEngine() {
  // Guard against parallel initialization
  if (engineState.initializing) {
    console.log('[ASMG Background] Already initializing, skipping duplicate call');
    return false;
  }
  engineState.initializing = true;
  
  console.log('[ASMG Background] Initializing ML engine...');
  
  try {
    await initTensorFlow();
    await initMobileNet();
    console.log('[ASMG Background] Engine fully ready');
    engineState.modelReady = true;
    return true;
  } catch (error) {
    console.error('[ASMG Background] Engine init failed:', error.message);
    // Reset so retry will actually try again
    engineState.modelLoadAttempted = false;
    engineState.tfReady = false;
    engineState.modelReady = false;
    throw error;
  } finally {
    engineState.initializing = false;
  }
}

async function initTensorFlow() {
  if (typeof tf === 'undefined') {
    throw new Error('TensorFlow.js not loaded as background script. Check manifest.json background scripts order.');
  }
  
  console.log('[ASMG Background] TensorFlow.js found. Backends:', tf.getBackend());
  
  try {
    await tf.setBackend('cpu');
    console.log('[ASMG Background] TF backend set to CPU');
  } catch (e) {
    console.warn('[ASMG Background] CPU backend not available, using default:', e.message);
  }
  
  engineState.tfReady = true;
}

async function initMobileNet() {
  if (typeof mobilenet === 'undefined') {
    throw new Error('MobileNet library not loaded as background script. Check manifest.json.');
  }
  
  if (engineState.modelLoadAttempted) return;
  engineState.modelLoadAttempted = true;
  
  console.log('[ASMG Background] Loading MobileNet model from TF Hub (~4MB)...');
  
  try {
    engineState.mobilenetModel = await mobilenet.load({
      version: 1,
      alpha: 0.25,
      inputRange: [0, 1]
    });
    
    engineState.modelReady = true;
    console.log('[ASMG Background] MobileNet model loaded successfully');
  } catch (error) {
    engineState.modelLoadAttempted = false; // Allow retry
    console.error('[ASMG Background] MobileNet load failed:', error.message);
    throw error;
  }
}

// ============================================
// IMAGE ANALYSIS
// ============================================

async function analyzeImage(imageUrl, imageDataUrl) {
  // Ensure model is ready
  if (!engineState.modelReady) {
    if (!engineState.modelLoadAttempted) {
      await initMobileNet();
    } else {
      throw new Error('Model is still loading, please wait...');
    }
  }
  
  // Load the image
  let img;
  if (imageDataUrl) {
    img = await loadImageFromDataUrl(imageDataUrl);
  } else if (imageUrl) {
    img = await loadImageFromUrl(imageUrl);
  } else {
    throw new Error('No image source provided');
  }
  
  // Run MobileNet inference
  const rawPredictions = await engineState.mobilenetModel.classify(img, 5);
  
  const predictions = rawPredictions.map(p => ({
    className: p.className,
    probability: p.probability
  }));
  
  console.log('[ASMG Background] Predictions:', predictions);
  
  // Generate metadata
  return generateMetadata(predictions, img);
}

async function loadImageFromUrl(imageUrl) {
  console.log('[ASMG Background] Fetching image from URL:', imageUrl.substring(0, 80));
  
  try {
    const response = await fetch(imageUrl, {
      credentials: 'omit',
      headers: { 'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8' }
    });
    
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to decode image')); };
      img.src = objectUrl;
    });
  } catch (fetchError) {
    // Fallback: try with anonymous CORS
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image: ' + fetchError.message));
      img.src = imageUrl;
    });
  }
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image data'));
    img.src = dataUrl;
  });
}

// ============================================
// METADATA GENERATION
// ============================================

function generateMetadata(predictions, img) {
  let categoryId = 'landscapes';
  let categoryLabel = 'Landscapes';
  
  if (typeof predictCategory === 'function') {
    categoryId = predictCategory(predictions);
    const labels = {
      animals: 'Animals', architecture: 'Architecture', backgrounds: 'Backgrounds/Textures',
      business: 'Business', drinks: 'Drinks', education: 'Education',
      food: 'Food', graphic: 'Graphic Resources', hobbies: 'Hobbies and Leisure',
      industrial: 'Industrial', landscapes: 'Landscapes', lifestyle: 'Lifestyle',
      nature: 'Nature', people: 'People', plants: 'Plants and Flowers',
      science: 'Science and Technology', sports: 'Sports',
      transportation: 'Transportation', travel: 'Travel'
    };
    categoryLabel = labels[categoryId] || 'Landscapes';
  }
  
  // Title
  let title = 'Beautiful stock photography';
  if (typeof generateTitle === 'function') {
    try {
      title = generateTitle(predictions, categoryId, { isVideo: false });
    } catch (e) {
      title = (predictions[0]?.className || 'Scene') + ' - ' + categoryLabel;
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }
  
  // Keywords
  let keywords = [];
  if (typeof getKeywordsFromPredictions === 'function') {
    try {
      keywords = getKeywordsFromPredictions(predictions, categoryLabel);
    } catch (e) {
      keywords = generateFallbackKeywords(predictions, categoryId);
    }
  }
  
  keywords = keywords.slice(0, 47);
  
  // Supplementary visual info (colors, brightness)
  const visualData = analyzeVisualProperties(img);
  
  return {
    predictions: predictions,
    title: title,
    category: categoryId,
    categoryLabel: categoryLabel,
    keywords: keywords,
    colors: visualData.colors,
    lighting: visualData.lighting,
    composition: visualData.composition,
    imageInfo: { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height },
    mlModel: 'MobileNetV1-0.25',
    mlBackend: tf.getBackend()
  };
}

function analyzeVisualProperties(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const w = 112;
  const h = 112;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  
  return {
    colors: analyzeColors(pixels),
    lighting: analyzeLighting(pixels),
    composition: analyzeComposition(pixels, w, h)
  };
}

// Visual analysis helpers (same as before)
const COLOR_NAMES = {
  'red': [255, 0, 0], 'green': [0, 128, 0], 'blue': [0, 0, 255],
  'yellow': [255, 255, 0], 'orange': [255, 165, 0], 'purple': [128, 0, 128],
  'pink': [255, 192, 203], 'brown': [165, 42, 42], 'gray': [128, 128, 128],
  'white': [255, 255, 255], 'black': [0, 0, 0], 'teal': [0, 128, 128],
  'navy': [0, 0, 128], 'cyan': [0, 255, 255], 'lime': [0, 255, 0],
  'gold': [255, 215, 0], 'silver': [192, 192, 192], 'beige': [245, 245, 220],
  'coral': [255, 127, 80], 'lavender': [230, 230, 250], 'turquoise': [64, 224, 208],
  'olive': [128, 128, 0], 'maroon': [128, 0, 0], 'indigo': [75, 0, 130]
};

function analyzeColors(pixels) {
  const colorBuckets = {};
  const step = 4;
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const r = Math.round(pixels[i] / 32) * 32;
    const g = Math.round(pixels[i + 1] / 32) * 32;
    const b = Math.round(pixels[i + 2] / 32) * 32;
    const key = `${r},${g},${b}`;
    colorBuckets[key] = (colorBuckets[key] || 0) + 1;
  }
  const sortedColors = Object.entries(colorBuckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [r, g, b] = key.split(',').map(Number);
      return { rgb: { r, g, b }, hex: rgbToHex(r, g, b), name: getColorName(r, g, b) };
    });
  let totalSat = 0, satCount = 0;
  for (let i = 0; i < pixels.length; i += 4 * 8) {
    const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    totalSat += max === 0 ? 0 : (max - min) / max;
    satCount++;
  }
  const avgSat = totalSat / satCount;
  const warmCount = sortedColors.filter(c => ['red','orange','yellow','pink','gold','coral'].includes(c.name)).length;
  const coolCount = sortedColors.filter(c => ['blue','green','purple','teal','navy','cyan','turquoise','indigo'].includes(c.name)).length;
  let paletteType = 'mixed';
  if (warmCount > coolCount && warmCount > 1) paletteType = 'warm';
  else if (coolCount > warmCount && coolCount > 1) paletteType = 'cool';
  else if (sortedColors.every(c => ['gray','white','black','beige','silver'].includes(c.name))) paletteType = 'neutral';
  return {
    dominantColors: sortedColors, saturationLevel: avgSat > 0.6 ? 'vibrant' : avgSat > 0.3 ? 'moderate' : 'muted',
    paletteType: paletteType, mainColorName: sortedColors[0]?.name || 'colorful'
  };
}

function analyzeLighting(pixels) {
  let totalBrightness = 0, pixelCount = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    totalBrightness += (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }
  const avgBrightness = totalBrightness / pixelCount;
  const brightnessDesc = avgBrightness > 180 ? 'bright' : avgBrightness > 120 ? 'well-lit' : avgBrightness > 60 ? 'dim' : 'dark';
  return { averageBrightness: Math.round(avgBrightness), description: brightnessDesc, brightnessLevel: brightnessDesc };
}

function analyzeComposition(pixels, width, height) {
  if (height === 0) return { detailLevel: 'unknown', aspectRatio: 1, isPortrait: false, isPanoramic: false, isSquare: true };
  return {
    detailLevel: 'analyzed', aspectRatio: width / height,
    isPanoramic: (width / height) > 2, isPortrait: (height / width) > 1.3,
    isSquare: (width / height) >= 0.8 && (width / height) <= 1.2
  };
}

function getColorName(r, g, b) {
  let closest = 'colorful', minDist = Infinity;
  for (const [name, [nr, ng, nb]] of Object.entries(COLOR_NAMES)) {
    const dist = Math.sqrt(Math.pow(r - nr, 2) + Math.pow(g - ng, 2) + Math.pow(b - nb, 2));
    if (dist < minDist) { minDist = dist; closest = name; }
  }
  return closest;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => { const hex = x.toString(16); return hex.length === 1 ? '0' + hex : hex; }).join('');
}

function generateFallbackKeywords(predictions, category) {
  const keywords = ['stock photo', 'photography', 'digital image', 'stock image', 'royalty free'];
  predictions.forEach(p => {
    const parts = p.className.split(/[, ]+/);
    parts.forEach(part => {
      const trimmed = part.trim().toLowerCase();
      if (trimmed.length > 2 && !keywords.includes(trimmed)) keywords.push(trimmed);
    });
  });
  const catKeywords = {
    animals: ['animal', 'wildlife'], nature: ['nature', 'landscape'], food: ['food', 'cuisine'],
    architecture: ['architecture', 'building'], people: ['people', 'portrait'],
    landscapes: ['landscape', 'scenic'], backgrounds: ['background', 'texture'],
    business: ['business', 'corporate'], science: ['technology', 'digital'],
    sports: ['sports', 'fitness'], travel: ['travel', 'tourism'],
    transportation: ['vehicle'], plants: ['plant', 'flower'], lifestyle: ['lifestyle']
  };
  (catKeywords[category] || catKeywords.landscapes).forEach(k => { if (!keywords.includes(k)) keywords.push(k); });
  return keywords.slice(0, 47);
}

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_SETTINGS = {
  autoAnalyze: false, generateTitle: true, generateKeywords: true,
  autoSelectCategory: true, keywordCount: 47, bulkSelectEnabled: true,
  showAnalysisPanel: true, analysisEngineReady: false
};

async function initSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    if (!result.settings) await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  } catch (error) { console.error('Error initializing settings:', error); }
}

async function getSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) { return DEFAULT_SETTINGS; }
}

async function updateSettings(updates) {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await browser.storage.local.set({ settings: updated });
  return updated;
}

// ============================================
// MESSAGE HANDLING
// ============================================

browser.runtime.onInstalled.addListener(() => {
  initSettings();
  initEngine().catch(e => console.error('[ASMG] Background engine init failed:', e.message));
});

// Start initialization immediately too
initEngine().catch(e => console.error('[ASMG] Background engine init failed:', e.message));

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      getSettings().then(s => sendResponse({ settings: s }));
      return true;

    case 'UPDATE_SETTINGS':
      updateSettings(message.settings).then(settings => {
        browser.tabs.query({ url: 'https://contributor.stock.adobe.com/*' }).then(tabs => {
          tabs.forEach(tab => {
            browser.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings }).catch(() => {});
          });
        });
        sendResponse({ settings });
      });
      return true;

    case 'ANALYZE_IMAGE':
      if (engineState.analyzing) {
        sendResponse({ error: 'Analysis already in progress' });
        return;
      }
      engineState.analyzing = true;
      
      analyzeImage(message.imageUrl, message.imageDataUrl)
        .then(results => {
          sendResponse({ success: true, results });
        })
        .catch(error => {
          sendResponse({ error: error.message });
        })
        .finally(() => {
          engineState.analyzing = false;
        });
      return true; // Keep channel open for async response

    case 'GET_ENGINE_STATUS':
      sendResponse({
        tfReady: engineState.tfReady,
        modelReady: engineState.modelReady,
        available: engineState.tfReady && engineState.modelReady
      });
      break;

    case 'OPEN_OPTIONS':
      browser.runtime.openOptionsPage();
      break;

    default:
      break;
  }
});

console.log('[ASMG Background] Script loaded');
