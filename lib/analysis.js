/**
 * Analysis Engine v4 - Real TensorFlow.js MobileNet Image Classification
 *
 * This engine uses an actual pre-trained MobileNet model loaded via TensorFlow.js
 * to perform real ImageNet classification on images and videos.
 *
 * Architecture:
 * 1. TensorFlow.js + MobileNet are bundled in lib/vendor/ and loaded via script tags
 * 2. On init, the MobileNet model is downloaded from TF Hub and cached
 * 3. When analyzing, the image is preprocessed (resized to 224x224, normalized)
 * 4. MobileNet runs inference and returns top ImageNet class predictions
 * 5. Predictions are mapped to Adobe Stock metadata using data/*.js files
 * 6. Basic visual analysis (colors, lighting) supplements the ML predictions
 *
 * Communication with parent content script via window.postMessage.
 */

let ready = false;
let analyzing = false;
let tfReady = false;
let modelReady = false;
let mobilenetModel = null;
let modelLoadAttempted = false;

// Color name lookup table (supplementary visual analysis)
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

// ============================================
// INITIALIZATION
// ============================================

async function initEngine() {
  try {
    await loadTensorFlow();
    await loadMobileNetModel();
    ready = true;
    window.parent.postMessage({ type: 'ANALYSIS_ENGINE_READY', ready: true }, '*');
  } catch (error) {
    console.error('[ASMG Analysis] Engine init failed:', error);
    window.parent.postMessage({
      type: 'ANALYSIS_ENGINE_ERROR',
      error: error.message
    }, '*');
    // Reset so retry is possible
    modelLoadAttempted = false;
  }
}

/**
 * Wait for TensorFlow.js to be available globally, then set backend to CPU
 * (CPU backend avoids CSP issues with WebGL's eval() usage in extensions)
 */
async function loadTensorFlow() {
  if (typeof tf !== 'undefined') {
    // Always try CPU backend first to avoid CSP issues
    try {
      await tf.setBackend('cpu');
      console.log('[ASMG] TensorFlow.js loaded, backend:', tf.getBackend());
      tfReady = true;
      return;
    } catch (e) {
      console.warn('[ASMG] CPU backend failed, trying default backend:', e.message);
      // CPU not available, TF will auto-select WebGL or WASM
      tfReady = true;
      return;
    }
  }

  // Poll for tf to load (in case scripts are still loading)
  for (let i = 0; i < 100; i++) {
    if (typeof tf !== 'undefined') {
      try {
        await tf.setBackend('cpu');
        console.log('[ASMG] TensorFlow.js loaded on poll, backend:', tf.getBackend());
      } catch (e) {
        console.warn('[ASMG] CPU backend not available on poll, using default:', e.message);
      }
      tfReady = true;
      return;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('TensorFlow.js failed to load after 10 seconds - tf.min.js may be missing');
}

/**
 * Load the MobileNet model from TF Hub
 */
async function loadMobileNetModel() {
  if (modelLoadAttempted) return;
  modelLoadAttempted = true;

  console.log('[ASMG] Loading MobileNet model...');
  window.parent.postMessage({ type: 'MODEL_LOADING', message: 'Loading MobileNet...' }, '*');

  try {
    // Check if mobileNet global is available (from mobilenet.min.js)
    if (typeof mobilenet === 'undefined') {
      // Wait a bit for the script to load
      for (let i = 0; i < 50; i++) {
        if (typeof mobilenet !== 'undefined') break;
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (typeof mobilenet === 'undefined') {
      throw new Error('MobileNet library not loaded (mobilenet.min.js may be missing)');
    }

    // Load the model with version 1 (MobileNetV1) and alpha 0.25 (smallest, fastest)
    // This downloads ~4MB instead of ~16MB and runs faster
    mobilenetModel = await mobilenet.load({
      version: 1,
      alpha: 0.25,
      inputRange: [0, 1]
    });

    modelReady = true;
    console.log('[ASMG] MobileNet loaded successfully');
    window.parent.postMessage({ type: 'MODEL_LOADED', message: 'MobileNet ready' }, '*');
  } catch (error) {
    console.error('[ASMG] MobileNet load failed:', error);
    window.parent.postMessage({
      type: 'MODEL_LOAD_ERROR',
      error: 'MobileNet failed to load: ' + error.message + '. Check internet connection and host_permissions.'
    }, '*');
    throw error;
  }
}

// ============================================
// IMAGE LOADING
// ============================================

async function loadImage(imageUrl, imageDataUrl) {
  if (imageDataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image data'));
      img.src = imageDataUrl;
    });
  }

  if (imageUrl) {
    try {
      const response = await fetch(imageUrl, {
        credentials: 'omit',
        headers: { 'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => { URL.revokeObjectURL(objectUrl); resolve(i); };
        i.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to decode image')); };
        i.src = objectUrl;
      });

      return img;
    } catch (fetchError) {
      // Fallback: try loading the URL directly
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not load image: ' + fetchError.message));
        img.src = imageUrl;
      });
    }
  }

  throw new Error('No image source provided');
}

// ============================================
// MAIN ANALYSIS WITH TENSORFLOW.JS MOBILENET
// ============================================

async function analyzeImage(imageUrl, imageDataUrl, isVideo = false) {
  // Ensure model is loaded
  if (!modelReady) {
    if (!modelLoadAttempted) {
      await loadMobileNetModel();
    } else {
      // Wait for model to finish loading
      for (let i = 0; i < 100; i++) {
        if (modelReady) break;
        await new Promise(r => setTimeout(r, 300));
      }
      if (!modelReady) {
        throw new Error('MobileNet model not loaded yet. Please wait for initialization.');
      }
    }
  }

  if (!tfReady) {
    throw new Error('TensorFlow.js is not initialized');
  }

  try {
    // Load the image
    const img = await loadImage(imageUrl, imageDataUrl);

    // Run actual MobileNet classification
    const predictions = await runMobileNetInference(img);

    // Run supplementary visual analysis (colors, lighting - heuristics)
    const visualData = await runVisualAnalysis(img);

    // Predict Adobe Stock category using MobileNet predictions
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

    // Generate title
    let title = isVideo ? 'Cinematic stock video footage' : 'Beautiful stock photography';
    try {
      if (typeof generateTitle === 'function') {
        title = generateTitle(predictions, categoryId, { isVideo: isVideo });
      }
    } catch (e) {
      title = `${predictions[0]?.className || 'Scene'} - ${categoryLabel}`;
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    // Generate keywords
    let keywords = [];
    try {
      if (typeof getKeywordsFromPredictions === 'function') {
        keywords = getKeywordsFromPredictions(predictions, categoryLabel);
      }
    } catch (e) {
      keywords = generateKeywordFallback(predictions, categoryId);
    }

    // Add video-specific keywords if applicable
    if (isVideo) {
      const videoKws = ['video', 'footage', 'motion', 'stock footage', 'cinematic'];
      videoKws.forEach(k => { if (!keywords.includes(k)) keywords.push(k); });
    }

    // Trim to 47 keywords (Adobe Stock limit)
    keywords = keywords.slice(0, 47);

    return {
      predictions: predictions,
      colors: visualData.colors,
      lighting: visualData.lighting,
      composition: visualData.composition,
      imageInfo: visualData.imageInfo,
      title: title,
      category: categoryId,
      categoryLabel: categoryLabel,
      keywords: keywords,
      isVideo: isVideo,
      mlModel: 'MobileNetV1-0.25',
      mlBackend: tf.getBackend()
    };
  } catch (e) {
    throw new Error('Analysis failed: ' + e.message);
  }
}

// ============================================
// MOBILENET INFERENCE
// ============================================

/**
 * Run MobileNet inference on an image and return top predictions
 */
async function runMobileNetInference(img) {
  console.log('[ASMG] Running MobileNet inference...');

  // Get the top 5 predictions from MobileNet
  // mobilenetModel.classify() handles all preprocessing internally:
  // - Resizes to 224x224
  // - Normalizes pixel values
  // - Runs inference
  // - Returns top-k class names with probabilities
  const rawPredictions = await mobilenetModel.classify(img, 5);

  console.log('[ASMG] MobileNet predictions:', rawPredictions);

  // Map predictions to our format: { className, probability }
  return rawPredictions.map(p => ({
    className: p.className,
    probability: p.probability
  }));
}

// ============================================
// SUPPLEMENTARY VISUAL ANALYSIS
// ============================================

async function runVisualAnalysis(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Use a small size for analysis
  const w = 112;
  const h = 112;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const colors = analyzeColors(pixels);
  const lighting = analyzeLighting(pixels);
  const composition = analyzeComposition(pixels, w, h);

  return {
    colors,
    lighting,
    composition,
    imageInfo: {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    }
  };
}

// ============================================
// COLOR ANALYSIS (Same as before, supplementary)
// ============================================

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

  // Calculate saturation level
  let totalSat = 0;
  let satCount = 0;
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
    dominantColors: sortedColors,
    saturationLevel: avgSat > 0.6 ? 'vibrant' : avgSat > 0.3 ? 'moderate' : 'muted',
    paletteType: paletteType,
    mainColorName: sortedColors[0]?.name || 'colorful'
  };
}

function analyzeLighting(pixels) {
  let totalBrightness = 0;
  const brightnessValues = [];
  const pixelCount = pixels.length / 4;

  for (let i = 0; i < pixels.length; i += 4) {
    const brightness = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    totalBrightness += brightness;
    brightnessValues.push(brightness);
  }

  const avgBrightness = totalBrightness / pixelCount;
  const variance = brightnessValues.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / pixelCount;
  const contrast = Math.sqrt(variance);

  const brightnessDesc = avgBrightness > 180 ? 'bright' : avgBrightness > 120 ? 'well-lit' : avgBrightness > 60 ? 'dim' : 'dark';
  const contrastDesc = contrast > 60 ? 'high contrast' : contrast > 30 ? 'moderate contrast' : 'low contrast';

  let timeHint = null;
  if (avgBrightness > 150) {
    let warmPixelsCount = 0, total = 0;
    for (let i = 0; i < pixels.length; i += 4 * 16) {
      total++;
      if (pixels[i] > 180 && pixels[i + 1] > 100 && pixels[i + 1] < 180 && pixels[i + 2] < 120) warmPixelsCount++;
    }
    if (warmPixelsCount / total > 0.3) timeHint = 'golden hour';
  }
  if (!timeHint && avgBrightness < 80) timeHint = 'night';

  return {
    averageBrightness: Math.round(avgBrightness),
    contrast: Math.round(contrast),
    description: `${brightnessDesc}, ${contrastDesc}`,
    brightnessLevel: brightnessDesc,
    contrastLevel: contrastDesc,
    timeHint: timeHint
  };
}

function analyzeComposition(pixels, width, height) {
  let edgeScore = 0;
  let samples = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width - 1; x += 4) {
      const idx = (y * width + x) * 4;
      const idx2 = (y * width + x + 1) * 4;
      const diff = Math.abs(pixels[idx] - pixels[idx2]) +
                   Math.abs(pixels[idx + 1] - pixels[idx2 + 1]) +
                   Math.abs(pixels[idx + 2] - pixels[idx2 + 2]);
      edgeScore += diff;
      samples++;
    }
  }

  const avgEdge = edgeScore / samples;

  return {
    detailLevel: avgEdge > 40 ? 'high detail' : avgEdge > 20 ? 'moderate detail' : 'smooth/minimal',
    edgeScore: Math.round(avgEdge),
    aspectRatio: width / height,
    isPanoramic: (width / height) > 2,
    isPortrait: (height / width) > 1.3,
    isSquare: (width / height) >= 0.8 && (width / height) <= 1.2
  };
}

// ============================================
// KEYWORD FALLBACK
// ============================================

function generateKeywordFallback(predictions, category) {
  const keywords = ['stock photo', 'photography', 'digital image', 'stock image', 'royalty free'];

  predictions.forEach(p => {
    const parts = p.className.split(/[, ]+/);
    parts.forEach(part => {
      const trimmed = part.trim().toLowerCase();
      if (trimmed.length > 2 && !keywords.includes(trimmed)) keywords.push(trimmed);
    });
  });

  const catKeywords = {
    animals: ['animal', 'wildlife', 'nature'], nature: ['nature', 'landscape', 'scenic'],
    food: ['food', 'cuisine'], architecture: ['architecture', 'building', 'design'],
    people: ['people', 'portrait'], landscapes: ['landscape', 'scenic', 'view'],
    backgrounds: ['background', 'texture', 'pattern'], business: ['business', 'corporate', 'office'],
    science: ['technology', 'digital', 'computer'], sports: ['sports', 'fitness', 'active'],
    travel: ['travel', 'tourism', 'vacation'], transportation: ['vehicle', 'transport'],
    plants: ['plant', 'flower', 'garden'], lifestyle: ['lifestyle', 'people', 'home']
  };
  (catKeywords[category] || catKeywords.landscapes).forEach(k => { if (!keywords.includes(k)) keywords.push(k); });

  return keywords.slice(0, 47);
}

// ============================================
// UTILITIES
// ============================================

function getColorName(r, g, b) {
  let closest = 'colorful';
  let minDist = Infinity;
  for (const [name, [nr, ng, nb]] of Object.entries(COLOR_NAMES)) {
    const dist = Math.sqrt(Math.pow(r - nr, 2) + Math.pow(g - ng, 2) + Math.pow(b - nb, 2));
    if (dist < minDist) { minDist = dist; closest = name; }
  }
  return closest;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => { const hex = x.toString(16); return hex.length === 1 ? '0' + hex : hex; }).join('');
}

// ============================================
// MESSAGE HANDLING
// ============================================

window.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'ANALYZE_IMAGE':
      if (analyzing) {
        window.parent.postMessage({ type: 'ANALYSIS_BUSY', requestId: data.requestId }, '*');
        return;
      }
      analyzing = true;
      try {
        const results = await analyzeImage(data.imageUrl, data.imageDataUrl, data.isVideo === true);
        window.parent.postMessage({ type: 'ANALYSIS_RESULT', requestId: data.requestId, results: results }, '*');
      } catch (error) {
        window.parent.postMessage({ type: 'ANALYSIS_ERROR', requestId: data.requestId, error: error.message }, '*');
      } finally {
        analyzing = false;
      }
      break;

    case 'PING':
      window.parent.postMessage({
        type: 'PONG',
        ready: ready,
        analyzing: analyzing,
        tfReady: tfReady,
        modelReady: modelReady
      }, '*');
      break;
  }
});

// ============================================
// BOOTSTRAP
// ============================================

// Start initialization once scripts are loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngine);
} else {
  initEngine();
}
