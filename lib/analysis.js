/**
 * Analysis Engine v3 - Fetch images via extension URL, analyze pixel data
 * 
 * Runs in a hidden iframe within the content script context.
 * The iframe has extension host_permissions, so it can fetch images
 * from Adobe's CDN domains directly (bypassing CORS issues).
 * 
 * Analysis pipeline:
 * 1. Receive image URL from content script
 * 2. Fetch image using extension privileges (bypasses CORS)
 * 3. Load into canvas and analyze pixels (colors, lighting, composition)
 * 4. Generate meaningful scene/object predictions based on visual properties
 * 5. Map predictions to Adobe Stock categories, titles, and keywords
 * 
 * Communication with parent content script via window.postMessage.
 */

let ready = false;
let analyzing = false;

// Color name lookup table
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

function initEngine() {
  ready = true;
  window.parent.postMessage({ type: 'ANALYSIS_ENGINE_READY', ready: true }, '*');
}

// ============================================
// IMAGE LOADING
// ============================================

/**
 * Load an image from either a URL (fetched via extension privileges) or a data URL
 */
async function loadImage(imageUrl, imageDataUrl) {
  if (imageDataUrl) {
    // Data URL - load directly (used for video frames)
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image data'));
      img.src = imageDataUrl;
    });
  }
  
  if (imageUrl) {
    // URL - fetch using extension host_permissions to bypass CORS
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
      // Fallback: try loading the URL directly with crossOrigin
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
// MAIN ANALYSIS
// ============================================

async function analyzeImage(imageUrl, imageDataUrl, isVideo = false) {
  try {
    const img = await loadImage(imageUrl, imageDataUrl);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Resize to manageable size for analysis
    const maxSize = 224;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (w > maxSize || h > maxSize) {
      const ratio = Math.min(maxSize / w, maxSize / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    
    // Run all visual analyses
    const colors = analyzeColors(pixels);
    const lighting = analyzeLighting(pixels);
    const composition = analyzeComposition(pixels, w, h);
    
    // Generate meaningful predictions based on visual properties
    const predictions = generatePredictions(colors, lighting, composition);
    
    // Predict category using both visual properties and predictions
    const categoryResult = predictCategory(colors, lighting, composition, predictions);
    
    // Generate complete metadata using data scripts
    const metadata = generateCompleteMetadata(predictions, colors, lighting, composition, categoryResult, isVideo);
    
    return {
      predictions: predictions,
      colors: colors,
      lighting: lighting,
      composition: composition,
      imageInfo: { width: w, height: h },
      title: metadata.title,
      category: categoryResult.id,
      categoryLabel: categoryResult.label,
      keywords: metadata.keywords,
      isVideo: isVideo
    };
  } catch (e) {
    throw new Error('Analysis failed: ' + e.message);
  }
}

// ============================================
// COLOR ANALYSIS
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
  
  // Determine palette type
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

// ============================================
// LIGHTING ANALYSIS
// ============================================

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
  
  // Determine time of day based on color temperature
  let timeHint = null;
  if (avgBrightness > 150) {
    // Check for warm tones (golden hour)
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

// ============================================
// COMPOSITION ANALYSIS
// ============================================

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
// PREDICTION GENERATION
// ============================================

/**
 * Generate meaningful scene/object predictions from visual properties.
 * These predictions use real-world names that match the keyword/category/title databases.
 */
function generatePredictions(colors, lighting, composition) {
  const predictions = [];
  const mainColor = colors.mainColorName;
  const palette = colors.paletteType;
  const brightness = lighting.brightnessLevel;
  const saturation = colors.saturationLevel;
  
  // ===== WARM PALETTE PREDICTIONS =====
  if (palette === 'warm') {
    if (brightness === 'bright' || brightness === 'well-lit') {
      predictions.push({ className: 'sunset', probability: 0.7 });
      predictions.push({ className: 'sunrise', probability: 0.5 });
      if (composition.isPanoramic) {
        predictions.push({ className: 'landscape', probability: 0.8 });
      }
    } else if (brightness === 'dim') {
      predictions.push({ className: 'interior', probability: 0.6 });
      predictions.push({ className: 'food', probability: 0.4 });
    }
    if (saturation === 'vibrant' && composition.detailLevel === 'high detail') {
      predictions.push({ className: 'flower', probability: 0.5 });
    }
    if (mainColor === 'orange' || mainColor === 'gold') {
      predictions.push({ className: 'sunset', probability: 0.75 });
    }
  }
  
  // ===== COOL PALETTE PREDICTIONS =====
  if (palette === 'cool') {
    if (brightness === 'bright' || brightness === 'well-lit') {
      predictions.push({ className: 'landscape', probability: 0.6 });
      predictions.push({ className: 'ocean', probability: 0.55 });
      predictions.push({ className: 'mountain', probability: 0.45 });
      if (mainColor === 'blue') {
        predictions.push({ className: 'ocean', probability: 0.7 });
        predictions.push({ className: 'sky', probability: 0.5 });
      }
      if (mainColor === 'green') {
        predictions.push({ className: 'forest', probability: 0.6 });
        predictions.push({ className: 'trees', probability: 0.5 });
      }
    } else if (brightness === 'dim' || brightness === 'dark') {
      predictions.push({ className: 'night', probability: 0.6 });
      predictions.push({ className: 'computer', probability: 0.4 });
      predictions.push({ className: 'smartphone', probability: 0.3 });
    }
    if (mainColor === 'teal' || mainColor === 'cyan') {
      predictions.push({ className: 'ocean', probability: 0.65 });
      predictions.push({ className: 'water', probability: 0.5 });
    }
  }
  
  // ===== NEUTRAL PALETTE PREDICTIONS =====
  if (palette === 'neutral') {
    if (brightness === 'bright' || brightness === 'well-lit') {
      predictions.push({ className: 'architecture', probability: 0.6 });
      predictions.push({ className: 'building', probability: 0.5 });
      predictions.push({ className: 'minimal', probability: 0.4 });
    } else {
      predictions.push({ className: 'office', probability: 0.5 });
      predictions.push({ className: 'business', probability: 0.4 });
    }
    if (composition.detailLevel === 'high detail') {
      predictions.push({ className: 'texture', probability: 0.5 });
      predictions.push({ className: 'background', probability: 0.5 });
    }
    if (mainColor === 'white' || mainColor === 'gray') {
      predictions.push({ className: 'minimal', probability: 0.6 });
      predictions.push({ className: 'interior', probability: 0.4 });
    }
  }
  
  // ===== MIXED PALETTE PREDICTIONS =====
  if (palette === 'mixed') {
    if (composition.detailLevel === 'high detail') {
      predictions.push({ className: 'landscape', probability: 0.5 });
      predictions.push({ className: 'nature', probability: 0.4 });
    } else {
      predictions.push({ className: 'travel', probability: 0.4 });
      predictions.push({ className: 'cityscape', probability: 0.3 });
    }
  }
  
  // ===== ASPECT RATIO PREDICTIONS =====
  if (composition.isPanoramic) {
    predictions.push({ className: 'landscape', probability: 0.75 });
    predictions.push({ className: 'mountain', probability: 0.5 });
    predictions.push({ className: 'valley', probability: 0.4 });
    predictions.push({ className: 'ocean', probability: 0.4 });
  }
  
  if (composition.isPortrait) {
    predictions.push({ className: 'person', probability: 0.5 });
    predictions.push({ className: 'portrait', probability: 0.4 });
    predictions.push({ className: 'flower', probability: 0.3 });
  }
  
  // ===== SATURATION PREDICTIONS =====
  if (saturation === 'vibrant' && predictions.length < 4) {
    predictions.push({ className: 'flower', probability: 0.5 });
    predictions.push({ className: 'fruit', probability: 0.4 });
  }
  
  if (saturation === 'muted' && predictions.length < 4) {
    predictions.push({ className: 'minimal', probability: 0.4 });
    predictions.push({ className: 'background', probability: 0.3 });
  }
  
  // ===== BRIGHTNESS PREDICTIONS =====
  if (brightness === 'dark') {
    // Remove any bright-scene predictions
    const filtered = predictions.filter(p => 
      p.className !== 'sunset' && p.className !== 'sunrise' && 
      p.className !== 'daylight' && p.className !== 'bright'
    );
    predictions.length = 0;
    filtered.forEach(p => predictions.push(p));
    predictions.push({ className: 'night', probability: 0.7 });
    predictions.push({ className: 'dslr', probability: 0.3 });
  }
  
  // ===== FALLBACK FOR LOW PREDICTION COUNT =====
  if (predictions.length < 2) {
    predictions.push({ className: 'landscape', probability: 0.4 });
    predictions.push({ className: 'nature', probability: 0.3 });
  }
  
  // Deduplicate by className
  const seen = new Set();
  return predictions
    .filter(p => {
      const key = p.className.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

// ============================================
// CATEGORY PREDICTION
// ============================================

/**
 * Predict Adobe Stock category from visual analysis + predictions.
 * Uses a scoring system rather than hardcoded defaults.
 */
function predictCategory(colors, lighting, composition, predictions) {
  const scores = {};
  
  // Initialize all categories
  const categories = [
    'animals', 'architecture', 'backgrounds', 'business', 'drinks',
    'education', 'food', 'graphic', 'hobbies', 'industrial',
    'landscapes', 'lifestyle', 'nature', 'people', 'plants',
    'science', 'sports', 'transportation', 'travel'
  ];
  categories.forEach(c => scores[c] = 0);
  
  // Score from predictions (check prediction classNames against category keywords)
  if (predictions && predictions.length > 0) {
    const combinedText = predictions.map(p => p.className.toLowerCase()).join(' ');
    
    // Animals
    if (/dog|cat|bird|fish|horse|lion|tiger|bear|elephant|monkey|rabbit|duck|animal|pet|wildlife|mammal|reptile/.test(combinedText)) scores.animals += 3;
    
    // Architecture
    if (/building|architecture|skyscraper|bridge|house|cityscape|skyline|structure|facade|architectural/.test(combinedText)) scores.architecture += 3;
    
    // Backgrounds/Textures
    if (/background|texture|pattern|minimal|abstract|wallpaper/.test(combinedText)) scores.backgrounds += 3;
    
    // Business
    if (/business|corporate|office|meeting|conference|professional|workplace|career/.test(combinedText)) scores.business += 3;
    
    // Food
    if (/food|cuisine|pizza|fruit|vegetable|coffee|drink|cooking|meal|dish|culinary|gourmet|dining/.test(combinedText)) scores.food += 3;
    
    // Education
    if (/education|school|learning|study|book|classroom|student|teacher|knowledge|academic/.test(combinedText)) scores.education += 3;
    
    // Industrial
    if (/industrial|factory|manufacturing|machinery|equipment|construction|engineering|industry/.test(combinedText)) scores.industrial += 3;
    
    // Landscapes
    if (/landscape|mountain|ocean|beach|sunset|sunrise|valley|forest|desert|lake|river|waterfall|field|sky|panorama|scenery/.test(combinedText)) scores.landscapes += 3;
    
    // Lifestyle
    if (/lifestyle|fitness|health|wellness|fashion|family|travel|leisure|home/.test(combinedText)) scores.lifestyle += 2;
    
    // Nature
    if (/nature|forest|tree|flower|plant|garden|outdoor|environment|wilderness|natural|green/.test(combinedText)) scores.nature += 3;
    
    // People
    if (/person|people|portrait|man|woman|child|family|crowd|human|face/.test(combinedText)) scores.people += 3;
    
    // Plants
    if (/plant|flower|floral|garden|leaf|botanical|bloom|herb|rose|tulip|succulent/.test(combinedText)) scores.plants += 3;
    
    // Science/Technology
    if (/computer|smartphone|technology|digital|science|laptop|tech|robot|electronic|device/.test(combinedText)) scores.science += 3;
    
    // Sports
    if (/sports|fitness|exercise|running|swimming|soccer|basketball|tennis|athlete|training|ball/.test(combinedText)) scores.sports += 3;
    
    // Transportation
    if (/car|vehicle|transportation|airplane|train|bicycle|truck|bus|boat|transport|automobile/.test(combinedText)) scores.transportation += 3;
    
    // Travel
    if (/travel|tourism|vacation|destination|adventure|journey|holiday|exploration/.test(combinedText)) scores.travel += 3;
    
    // Drinks (from combined predictions)
    if (/drink|beverage|coffee|tea|wine|juice|cocktail|glass|bottle/.test(combinedText)) scores.drinks += 2;
    
    // Hobbies
    if (/hobby|leisure|music|gaming|photography|painting|camping|fishing|craft|art/.test(combinedText)) scores.hobbies += 2;
    
    // Graphic
    if (/graphic|illustration|vector|icon|design|logo|typography|symbol/.test(combinedText)) scores.graphic += 2;
  }
  
  // Score from visual properties
  
  // Panoramic → landscapes, travel, nature
  if (composition.isPanoramic) {
    scores.landscapes += 3;
    scores.travel += 2;
    scores.nature += 1;
  }
  
  // Portrait orientation → people, lifestyle
  if (composition.isPortrait) {
    scores.people += 2;
    scores.lifestyle += 1;
    scores.plants += 1;
  }
  
  // Square → could be anything, boost backgrounds slightly
  if (composition.isSquare) {
    scores.backgrounds += 1;
  }
  
  // Warm palette → food, landscapes (sunset), nature
  if (colors.paletteType === 'warm') {
    scores.food += 2;
    scores.landscapes += 2;
    scores.nature += 1;
    scores.lifestyle += 1;
    if (colors.saturationLevel === 'vibrant') scores.food += 1;
  }
  
  // Cool palette → nature, technology, landscapes
  if (colors.paletteType === 'cool') {
    scores.nature += 2;
    scores.landscapes += 1;
    scores.science += 1;
    scores.transportation += 1;
  }
  
  // Neutral palette → backgrounds, architecture, business
  if (colors.paletteType === 'neutral') {
    scores.backgrounds += 2;
    scores.architecture += 1;
    scores.business += 1;
    if (composition.detailLevel === 'high detail') scores.backgrounds += 2;
  }
  
  // Bright lighting → landscapes, nature, travel, outdoor
  if (lighting.brightnessLevel === 'bright') {
    scores.landscapes += 2;
    scores.nature += 1;
    scores.travel += 1;
    scores.sports += 1;
  }
  
  // Dim/dark → technology, lifestyle, business (indoor)
  if (lighting.brightnessLevel === 'dim' || lighting.brightnessLevel === 'dark') {
    scores.science += 2;
    scores.lifestyle += 1;
    scores.business += 1;
    scores.backgrounds += 1;
  }
  
  // High detail → backgrounds (textures), nature (macro), architecture
  if (composition.detailLevel === 'high detail') {
    scores.backgrounds += 1;
    scores.nature += 1;
    scores.architecture += 1;
  }
  
  // Smooth/minimal → backgrounds, lifestyle (portraits with bokeh)
  if (composition.detailLevel === 'smooth/minimal') {
    scores.backgrounds += 1;
    scores.lifestyle += 1;
    scores.people += 1;
  }
  
  // Vibrant colors → food, nature, travel, sports
  if (colors.saturationLevel === 'vibrant') {
    scores.food += 1;
    scores.nature += 1;
    scores.travel += 1;
    scores.sports += 1;
  }
  
  // Muted colors → backgrounds, architecture, business
  if (colors.saturationLevel === 'muted') {
    scores.backgrounds += 1;
    scores.architecture += 1;
    scores.business += 1;
  }
  
  // Night time hint → science/tech (night photography), travel
  if (lighting.timeHint === 'night') {
    scores.science += 1;
    scores.travel += 1;
    scores.landscapes = Math.max(scores.landscapes - 1, 0); // Reduce landscapes for night shots
  }
  
  // Golden hour → landscapes, travel, nature
  if (lighting.timeHint === 'golden hour') {
    scores.landscapes += 2;
    scores.travel += 1;
    scores.nature += 1;
  }
  
  // Find the best category
  let bestCategory = categories[0];
  let bestScore = -1;
  for (const cat of categories) {
    if (scores[cat] > bestScore) {
      bestScore = scores[cat];
      bestCategory = cat;
    }
  }
  
  // Get label
  const categoryLabels = {
    animals: 'Animals', architecture: 'Architecture', backgrounds: 'Backgrounds/Textures',
    business: 'Business', drinks: 'Drinks', education: 'Education',
    food: 'Food', graphic: 'Graphic Resources', hobbies: 'Hobbies and Leisure',
    industrial: 'Industrial', landscapes: 'Landscapes', lifestyle: 'Lifestyle',
    nature: 'Nature', people: 'People', plants: 'Plants and Flowers',
    science: 'Science and Technology', sports: 'Sports',
    transportation: 'Transportation', travel: 'Travel'
  };
  
  return { id: bestCategory, label: categoryLabels[bestCategory] || 'Landscapes' };
}

// ============================================
// METADATA GENERATION
// ============================================

function generateCompleteMetadata(predictions, colors, lighting, composition, category, isVideo) {
  // Generate title using the data scripts
  let title = isVideo ? 'Cinematic stock video footage' : 'Beautiful stock photography';
  try {
    if (typeof generateTitle === 'function') {
      title = generateTitle(predictions, category.id, { isVideo: isVideo });
    }
  } catch (e) {
    // Fallback title from visual properties
    const sceneName = predictions.length > 0 ? predictions[0].className : 'scene';
    const adj = isVideo ? 'Cinematic' : 'Beautiful';
    title = `${adj} ${sceneName} - ${category.label} ${isVideo ? 'video' : 'photography'}`;
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  
  // Generate keywords using data scripts
  let keywords = [];
  try {
    if (typeof getKeywordsFromPredictions === 'function') {
      keywords = getKeywordsFromPredictions(predictions, category.label);
    }
  } catch (e) {
    keywords = generateFallbackKeywords(predictions, category.id);
  }
  
  // Add visual property-based keywords
  const visualKeywords = [
    colors.mainColorName, colors.saturationLevel,
    lighting.brightnessLevel, composition.detailLevel
  ].filter(k => k && k.length > 0);
  
  visualKeywords.forEach(k => {
    if (!keywords.includes(k)) keywords.push(k);
  });
  
  // Add video keywords if applicable
  if (isVideo) {
    ['video', 'footage', 'motion', 'stock footage', 'cinematic'].forEach(k => {
      if (!keywords.includes(k)) keywords.push(k);
    });
  }
  
  keywords = keywords.slice(0, 47);
  
  return { title, category: category.id, categoryLabel: category.label, keywords };
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

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;
  
  switch (data.type) {
    case 'ANALYZE_IMAGE':
      if (analyzing) {
        window.parent.postMessage({ type: 'ANALYSIS_BUSY', requestId: data.requestId }, '*');
        return;
      }
      analyzing = true;
      analyzeImage(data.imageUrl, data.imageDataUrl, data.isVideo === true)
        .then(results => {
          window.parent.postMessage({ type: 'ANALYSIS_RESULT', requestId: data.requestId, results: results }, '*');
        })
        .catch(error => {
          window.parent.postMessage({ type: 'ANALYSIS_ERROR', requestId: data.requestId, error: error.message }, '*');
        })
        .finally(() => { analyzing = false; });
      break;
      
    case 'PING':
      window.parent.postMessage({ type: 'PONG', ready: ready, analyzing: analyzing }, '*');
      break;
  }
});

// Initialize immediately
initEngine();
