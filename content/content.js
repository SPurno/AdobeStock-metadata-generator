/**
 * Content Script - Adobe Stock Metadata Generator
 * 
 * Integrates with the Adobe Stock contributor upload/edit page.
 * Provides: auto title generation, category selection, keyword input,
 * bulk selection, and image analysis.
 * 
 * The heavy ML processing and metadata generation happens in the analysis
 * iframe (lib/analysis.html) which can load data scripts properly.
 * This script handles: UI injection, DOM interaction, and coordination.
 * 
 * Runs on: https://contributor.stock.adobe.com/*
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  keywordLimit: 47,
  debug: false,
  selectors: {
    // Dynamic selectors based on ARIA labels and common patterns
    titleInput: 'input[aria-label*="title" i], input[placeholder*="title" i], input[name*="title" i], [data-testid*="title"] input',
    keywordsInput: 'textarea[aria-label*="keyword" i], input[aria-label*="keyword" i], [aria-label*="keyword"] input, textarea[placeholder*="keyword" i], [data-testid*="keyword"] textarea',
    categorySelect: 'select[aria-label*="categor" i], [aria-label*="categor"] select, [data-testid*="categor"] select, [data-testid*="categor"] div[role="listbox"]',
    uploadItem: '[data-testid*="upload" i], [data-testid*="asset" i], [class*="upload" i], [class*="asset" i], [class*="thumbnail" i], [class*="video" i]',
    imageInItem: 'img[class*="thumbnail" i], img[class*="preview" i], img[alt*="upload" i], img[alt*="preview" i]',
    videoInItem: 'video, [class*="video"] video, [class*="player"] video, [data-testid*="video"] video'
  },
  engineUrl: (typeof browser !== 'undefined' && browser.runtime) 
    ? browser.runtime.getURL('lib/analysis.html') 
    : 'lib/analysis.html'
};

// ============================================
// STATE
// ============================================

const state = {
  initialized: false,
  analysisFrame: null,
  engineReady: false,
  engineInitializing: false,
  selectedItems: new Set(),
  resultsCache: new Map(),
  currentRequestId: 0,
  settings: null,
  isAnalyzing: false
};

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  if (state.initialized) return;
  state.initialized = true;

  log('Content script initializing...');
  state.settings = await getSettings();
  createAnalysisFrame();
  injectUI();
  observePageChanges();
  setupMessageListeners();
  log('Content script initialized');
}

// ============================================
// ANALYSIS ENGINE IFRAME
// ============================================

function createAnalysisFrame() {
  if (state.analysisFrame || state.engineInitializing) return;
  state.engineInitializing = true;

  const iframe = document.createElement('iframe');
  iframe.src = CONFIG.engineUrl;
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none;';
  iframe.id = 'asmg-analysis-frame';
  iframe.onerror = () => { state.engineInitializing = false; };
  
  document.body.appendChild(iframe);
  state.analysisFrame = iframe;
  log('Analysis iframe created');
}

function waitForEngine(timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (state.engineReady) return resolve(true);
    
    const timeoutId = setTimeout(() => {
      reject(new Error('Analysis engine failed to load - check network connection'));
    }, timeout);
    
    const checkReady = () => {
      if (state.engineReady) {
        clearTimeout(timeoutId);
        resolve(true);
      } else {
        setTimeout(checkReady, 500);
      }
    };
    
    checkReady();
  });
}

// ============================================
// UI INJECTION
// ============================================

function injectUI() {
  if (document.getElementById('asmg-toolbar')) return;

  // Toolbar
  const toolbar = createEl('div', { id: 'asmg-toolbar', className: 'asmg-toolbar' });
  
  const btnAnalyze = createEl('button', { id: 'asmg-btn-analyze', className: 'asmg-toolbar-button' });
  btnAnalyze.append(createEl('span', { className: 'icon', textContent: '🔍' }), createEl('span', { textContent: 'Analyze Asset' }));
  toolbar.append(btnAnalyze);
  
  const btnBulk = createEl('button', { id: 'asmg-btn-bulk', className: 'asmg-toolbar-button secondary' });
  btnBulk.append(createEl('span', { className: 'icon', textContent: '☑' }), createEl('span', { textContent: 'Bulk Select' }));
  toolbar.append(btnBulk);
  
  const btnSettings = createEl('button', { id: 'asmg-btn-settings', className: 'asmg-toolbar-button secondary', style: 'padding:8px;min-width:36px;justify-content:center;' });
  btnSettings.append(createEl('span', { textContent: '⚙️' }));
  toolbar.append(btnSettings);
  
  document.body.appendChild(toolbar);

  // Analysis panel (hidden by default)
  const panel = createEl('div', { id: 'asmg-analysis-panel', className: 'asmg-analysis-panel', style: 'display:none;' });
  panel.append(createEl('h3', { textContent: '📊 Visual Analysis' }));
  const contentDiv = createEl('div', { id: 'asmg-analysis-content' });
  const placeholder = createEl('p', { style: 'color:#888;text-align:center;padding:20px 0;', textContent: 'Select an image and click "Analyze" to begin' });
  contentDiv.append(placeholder);
  panel.append(contentDiv);
  document.body.appendChild(panel);

  // Button handlers
  document.getElementById('asmg-btn-analyze').addEventListener('click', analyzeVisibleImage);
  document.getElementById('asmg-btn-bulk').addEventListener('click', toggleBulkMode);
  document.getElementById('asmg-btn-settings').addEventListener('click', togglePanel);

  log('UI injected');
}

/** Helper: create DOM element with attributes */
function createEl(tag, attrs) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (key === 'textContent') {
      el.textContent = val;
    } else if (key === 'style') {
      el.style.cssText = val;
    } else if (key === 'className') {
      el.className = val;
    } else {
      el.setAttribute(key, val);
    }
  }
  return el;
}

function togglePanel() {
  const panel = document.getElementById('asmg-analysis-panel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ============================================
// IMAGE URL EXTRACTION
// ============================================

/**
 * Get the best URL for an image element.
 * The analysis iframe will fetch the image directly using extension
 * host_permissions (bypasses CORS issues that break canvas capture).
 */
function getImageUrl(imgElement) {
  return imgElement.currentSrc || imgElement.src || null;
}

function findUploadAssets() {
  const assets = [];
  const uploadItems = document.querySelectorAll(CONFIG.selectors.uploadItem);
  
  uploadItems.forEach(item => {
    // First check for video elements
    const video = item.querySelector(CONFIG.selectors.videoInItem);
    if (video && video.tagName === 'VIDEO') {
      // Use the video's poster frame or current frame
      assets.push({
        element: video,
        container: item,
        src: video.poster || video.src || '',
        mediaType: 'video'
      });
      return;
    }
    
    // Check for thumbnail image
    const img = item.querySelector(CONFIG.selectors.imageInItem) || item.querySelector('img');
    if (img && img.src && (img.naturalWidth || img.width) > 0) {
      assets.push({
        element: img,
        container: item,
        src: img.src,
        mediaType: 'image'
      });
    }
  });
  
  // Fallback: any visible image or video on page
  if (assets.length === 0) {
    document.querySelectorAll('img').forEach(img => {
      if ((img.naturalWidth || img.width) > 50 && (img.naturalHeight || img.height) > 50) {
        assets.push({
          element: img,
          container: img.parentElement,
          src: img.src,
          mediaType: 'image'
        });
      }
    });
    // Also look for videos
    if (assets.length === 0) {
      document.querySelectorAll('video').forEach(video => {
        if (video.videoWidth > 0 || video.poster) {
          assets.push({
            element: video,
            container: video.parentElement,
            src: video.poster || video.src || '',
            mediaType: 'video'
          });
        }
      });
    }
  }
  
  return assets;
}

// ============================================
// IMAGE ANALYSIS (via iframe)
// ============================================

async function analyzeVisibleImage() {
  const assets = findUploadAssets();
  if (assets.length === 0) {
    showStatus('No images or videos found on the page', 'error');
    return;
  }
  await analyzeAsset(assets[0]);
}

async function analyzeAsset(assetInfo) {
  if (state.isAnalyzing) return;
  state.isAnalyzing = true;
  
  try {
    const isVideo = assetInfo.mediaType === 'video';
    
    if (isVideo) {
      showStatus('Capturing video frame...', 'analyzing');
      const dataUrl = await captureVideoFrame(assetInfo.element);
      if (!dataUrl) {
        showStatus('Could not capture video frame', 'error');
        return;
      }
      // Send captured frame to iframe for analysis
      await waitForEngine(5000);
      const requestId = ++state.currentRequestId;
      showStatus('Analyzing video frame...', 'analyzing');
      const results = await sendForAnalysis(dataUrl, requestId, true);
      showAnalysisResults(results);
      applyMetadata(results, assetInfo.container);
      return results;
    }
    
    // For images: send the URL directly to the iframe
    // The iframe will fetch it using extension host_permissions
    const imageUrl = getImageUrl(assetInfo.element);
    if (!imageUrl) {
      showStatus('Image has no source URL', 'error');
      return;
    }
    
    // Handle blob: URLs - fetch via XHR in content script (same-origin for blob URLs)
    if (imageUrl.startsWith('blob:')) {
      showStatus('Capturing image...', 'analyzing');
      try {
        const dataUrl = await captureBlobUrl(imageUrl);
        if (dataUrl) {
          await waitForEngine(5000);
          const requestId = ++state.currentRequestId;
          showStatus('Analyzing image...', 'analyzing');
          const results = await sendForAnalysis(dataUrl, requestId, false);
          showAnalysisResults(results);
          applyMetadata(results, assetInfo.container);
          return results;
        }
      } catch (e) {
        // blob: URL capture failed, try fetching from iframe
      }
    }
    
    showStatus('Analyzing image...', 'analyzing');
    await waitForEngine(5000);
    
    const requestId = ++state.currentRequestId;
    const results = await sendForAnalysis(imageUrl, requestId, false);
    
    showAnalysisResults(results);
    applyMetadata(results, assetInfo.container);
    return results;
  } catch (error) {
    log('Analysis error:', error);
    showStatus('Analysis failed: ' + error.message, 'error');
  } finally {
    state.isAnalyzing = false;
  }
}

function sendForAnalysis(imageUrlOrData, requestId, isVideo = false) {
  return new Promise((resolve, reject) => {
    if (!imageUrlOrData) {
      reject(new Error('No image source provided'));
      return;
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('Analysis timed out after 60s'));
    }, 60000);
    
    const handler = (event) => {
      if (event.data.type === 'ANALYSIS_RESULT' && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(event.data.results);
      } else if (event.data.type === 'ANALYSIS_ERROR' && event.data.requestId === requestId) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        reject(new Error(event.data.error));
      }
    };
    
    window.addEventListener('message', handler);
    
    const msg = { type: 'ANALYZE_IMAGE', requestId, isVideo };
    const isDataUrl = typeof imageUrlOrData === 'string' && imageUrlOrData.startsWith('data:');
    
    if (isVideo || isDataUrl) {
      msg.imageDataUrl = imageUrlOrData;
    } else {
      msg.imageUrl = imageUrlOrData;
    }
    
    state.analysisFrame.contentWindow.postMessage(msg, '*');
  });
}

// ============================================
// METADATA APPLICATION
// ============================================

function applyMetadata(metadata, container) {
  log('Applying metadata');
  
  const context = container || document;
  
  // Title
  if (metadata.title) {
    const titleInput = findField(context, CONFIG.selectors.titleInput, 'input');
    if (titleInput) {
      setFieldValue(titleInput, metadata.title);
      log('Title applied');
    }
  }
  
  // Keywords
  if (metadata.keywords && metadata.keywords.length > 0) {
    const keywordsInput = findField(context, CONFIG.selectors.keywordsInput, 'textarea') || 
                          findField(context, CONFIG.selectors.keywordsInput, 'input');
    if (keywordsInput) {
      setFieldValue(keywordsInput, metadata.keywords.join(', '));
      log('Keywords applied: ' + metadata.keywords.length);
    }
  }
  
  // Category
  if (metadata.category) {
    const categorySelect = findField(context, CONFIG.selectors.categorySelect, 'select');
    if (categorySelect) {
      selectCategory(categorySelect, metadata.category);
      log('Category applied: ' + (metadata.categoryLabel || metadata.category));
    }
  }
  
  showStatus('Metadata applied! ✓', 'ready');
  
  setTimeout(() => {
    const panel = document.getElementById('asmg-analysis-panel');
    if (panel) panel.style.display = 'none';
  }, 2000);
}

function findField(container, selectors, tagName) {
  const element = container.querySelector(selectors);
  if (element) return element;
  
  const searchTags = tagName ? [tagName] : ['input', 'textarea', 'select'];
  
  for (const tag of searchTags) {
    const elements = container.querySelectorAll(tag);
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
      const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
      const name = (el.getAttribute('name') || '').toLowerCase();
      
      if (selectors.includes('title') && (ariaLabel.includes('title') || placeholder.includes('title') || name.includes('title'))) return el;
      if (selectors.includes('keyword') && (ariaLabel.includes('keyword') || placeholder.includes('keyword') || name.includes('keyword'))) return el;
      if (selectors.includes('categor') && (ariaLabel.includes('categor') || placeholder.includes('categor') || name.includes('categor'))) return el;
    }
  }
  
  return null;
}

function setFieldValue(element, value) {
  // Use native setter to bypass React's synthetic event system
  const tagName = element.tagName;
  const proto = tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else {
    element.value = value;
  }
  
  // Dispatch events that SPAs listen to
  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function selectCategory(selectElement, categoryId) {
  if (selectElement.tagName === 'SELECT') {
    const categoryLabel = getCategoryLabelSimple(categoryId);
    for (const option of selectElement.options) {
      const text = option.textContent.toLowerCase();
      const value = option.value.toLowerCase();
      if (text.includes(categoryId) || value.includes(categoryId) || 
          (categoryLabel && (text.includes(categoryLabel.toLowerCase()) || value.includes(categoryLabel.toLowerCase())))) {
        selectElement.value = option.value;
        break;
      }
    }
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    selectElement.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    // Custom dropdown component
    selectElement.click();
    setTimeout(() => {
      const options = document.querySelectorAll('[role="option"], [class*="option"], li');
      const categoryLabel = getCategoryLabelSimple(categoryId);
      for (const option of options) {
        if (option.textContent.toLowerCase().includes((categoryLabel || categoryId).toLowerCase())) {
          option.click();
          break;
        }
      }
    }, 100);
  }
}

function getCategoryLabelSimple(categoryId) {
  const labels = {
    animals: 'Animals', architecture: 'Architecture', backgrounds: 'Backgrounds/Textures',
    business: 'Business', drinks: 'Drinks', education: 'Education',
    food: 'Food', graphic: 'Graphic Resources', hobbies: 'Hobbies and Leisure',
    industrial: 'Industrial', landscapes: 'Landscapes', lifestyle: 'Lifestyle',
    nature: 'Nature', people: 'People', plants: 'Plants and Flowers',
    science: 'Science and Technology', sports: 'Sports',
    transportation: 'Transportation', travel: 'Travel'
  };
  return labels[categoryId] || categoryId;
}

// ============================================
// ANALYSIS RESULTS DISPLAY
// ============================================

function showAnalysisResults(metadata) {
  const panel = document.getElementById('asmg-analysis-panel');
  const content = document.getElementById('asmg-analysis-content');
  
  if (!panel || !content) return;
  panel.style.display = 'block';
  
  // Clear previous content
  while (content.firstChild) content.removeChild(content.firstChild);
  
  // Media type badge
  if (metadata.isVideo) {
    const mediaBadge = createEl('div', { style: 'text-align:center;margin-bottom:8px;' });
    mediaBadge.append(createEl('span', { className: 'asmg-status-badge', style: 'background:#e3f2fd;color:#1565c0;padding:3px 10px;', textContent: '🎬 Video Asset' }));
    content.append(mediaBadge);
  }
  
  // Title section
  content.append(buildSection('📝 Title', 'value', metadata.title || ''));
  
  // Category section
  content.append(buildSection('🏷️ Category', 'value', metadata.categoryLabel || ''));
  
  // Predictions section
  const predSection = createEl('div', { className: 'asmg-analysis-section' });
  predSection.append(createEl('h4', { textContent: '🎯 Top Predictions' }));
  const preds = metadata.predictions || [];
  if (preds.length > 0) {
    preds.forEach(p => {
      const prob = Math.round((p.probability || 0) * 100);
      const bar = createEl('div', { className: 'asmg-prediction-bar' });
      bar.append(createEl('span', { className: 'label', textContent: p.className || 'unknown' }));
      const barBg = createEl('div', { className: 'bar-bg' });
      const barFill = createEl('div', { className: 'bar-fill', style: `width:${prob}%` });
      barBg.append(barFill);
      bar.append(barBg, createEl('span', { className: 'prob', textContent: `${prob}%` }));
      predSection.append(bar);
    });
  } else {
    predSection.append(createEl('div', { className: 'value', textContent: 'No predictions' }));
  }
  content.append(predSection);
  
  // Colors section
  const domColors = metadata.colors?.dominantColors || [];
  if (domColors.length > 0) {
    const colorSection = createEl('div', { className: 'asmg-analysis-section' });
    colorSection.append(createEl('h4', { textContent: '🎨 Dominant Colors' }));
    const swatches = createEl('div', { className: 'asmg-color-swatches' });
    domColors.forEach(c => {
      const swatch = createEl('div', { className: 'asmg-color-swatch', style: `background:${c.hex || '#ccc'}` });
      swatch.title = c.name || 'color';
      swatches.append(swatch);
    });
    colorSection.append(swatches);
    content.append(colorSection);
  }
  
  // Lighting section
  if (metadata.lighting) {
    content.append(buildSection('💡 Lighting', 'value', metadata.lighting.description || ''));
  }
  
  // Keywords section
  const kwSection = createEl('div', { className: 'asmg-analysis-section' });
  const kws = metadata.keywords || [];
  kwSection.append(createEl('h4', { textContent: `🔑 Keywords (${kws.length})` }));
  if (kws.length > 0) {
    const tags = createEl('div', { className: 'asmg-keyword-tags' });
    kws.slice(0, 20).forEach(k => {
      tags.append(createEl('span', { className: 'asmg-keyword-tag', textContent: k }));
    });
    kwSection.append(tags);
    if (kws.length > 20) {
      kwSection.append(createEl('div', { style: 'color:#888;font-size:11px;margin-top:4px;', textContent: `...and ${kws.length - 20} more` }));
    }
  } else {
    kwSection.append(createEl('div', { className: 'value', textContent: 'No keywords' }));
  }
  content.append(kwSection);
  
  // Apply button
  const applyBtn = createEl('button', { id: 'asmg-btn-apply-all', className: 'asmg-button-apply', textContent: '✅ Apply All Metadata' });
  applyBtn.addEventListener('click', () => applyMetadata(metadata, null));
  content.append(applyBtn);
  
  state.resultsCache.set('latest', metadata);
}

/** Helper: build a simple section with title and value */
function buildSection(title, valueClass, value) {
  const section = createEl('div', { className: 'asmg-analysis-section' });
  section.append(createEl('h4', { textContent: title }));
  section.append(createEl('div', { className: valueClass, textContent: value }));
  return section;
}

function showStatus(message, type = 'info') {
  log(`Status [${type}]: ${message}`);
  
  const analyzeBtn = document.getElementById('asmg-btn-analyze');
  if (analyzeBtn) {
    if (type === 'analyzing') {
      while (analyzeBtn.firstChild) analyzeBtn.removeChild(analyzeBtn.firstChild);
      const spinner = document.createElement('span');
      spinner.className = 'asmg-spinner';
      analyzeBtn.append(spinner, document.createTextNode(' Analyzing...'));
      analyzeBtn.disabled = true;
    } else {
      while (analyzeBtn.firstChild) analyzeBtn.removeChild(analyzeBtn.firstChild);
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = '🔍';
      analyzeBtn.append(icon, document.createTextNode(' Analyze Asset'));
      analyzeBtn.disabled = false;
    }
  }
  
  // Remove existing toast
  const existingToast = document.querySelector('.asmg-toast');
  if (existingToast) existingToast.remove();
  
  if (type === 'analyzing') return;
  
  const toast = document.createElement('div');
  toast.className = `asmg-toast asmg-status-badge ${type}`;
  const bgColors = { ready: '#e8f5e9', error: '#fbe9e7', default: '#fff3e0' };
  const textColors = { ready: '#2e7d32', error: '#c62828', default: '#e65100' };
  toast.style.cssText = `position:fixed;bottom:80px;right:20px;z-index:999999;padding:8px 16px;border-radius:8px;font-family:-apple-system,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.15);animation:asmg-slideIn 0.3s ease;background:${bgColors[type] || bgColors.default};color:${textColors[type] || textColors.default}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================
// FALLBACK ANALYSIS
// ============================================

/**
 * Capture a poster image from a URL as a data URL
 */
function capturePosterFrame(posterUrl) {
  return new Promise((resolve, reject) => {
    const posterImg = new Image();
    posterImg.crossOrigin = 'anonymous';
    posterImg.onload = () => {
      const maxDim = 800;
      const canvas = document.createElement('canvas');
      let w = posterImg.naturalWidth || posterImg.width;
      let h = posterImg.naturalHeight || posterImg.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(posterImg, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    posterImg.onerror = () => reject(new Error('Failed to load video poster'));
    posterImg.src = posterUrl;
  });
}

/**
 * Capture a frame from a video element at ~25% duration
 */
function captureVideoFrame(videoElement) {
  return new Promise((resolve, reject) => {
    try {
      // If the video has a poster, use that
      if (videoElement.poster) {
        capturePosterFrame(videoElement.poster).then(resolve).catch(() => {
          // Poster failed, try video frame capture
          tryCaptureFromVideo(videoElement, resolve, reject);
        });
        return;
      }
      
      // No poster - try to seek and capture from video source
      tryCaptureFromVideo(videoElement, resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Capture a blob URL as a data URL (same-origin, no CORS issues)
 */
function captureBlobUrl(blobUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load blob URL'));
    img.src = blobUrl;
  });
}

/**
 * Attempt to capture a frame from a video element by seeking
 */
function tryCaptureFromVideo(videoElement, resolve, reject) {
  const videoSrc = videoElement.currentSrc || videoElement.querySelector('source')?.src || videoElement.src;
  if (!videoSrc) {
    reject(new Error('No video source found'));
    return;
  }
  
  const tempVideo = document.createElement('video');
  tempVideo.muted = true;
  tempVideo.preload = 'auto';
  
  const videoTimeout = setTimeout(() => {
    tempVideo.remove();
    reject(new Error('Video load timed out'));
  }, 10000);
  
  tempVideo.onloadeddata = () => {
    clearTimeout(videoTimeout);
    const seekTime = Math.min(tempVideo.duration * 0.25, tempVideo.duration / 2);
    tempVideo.currentTime = seekTime;
    
    tempVideo.onseeked = () => {
      const maxDim = 800;
      let w = tempVideo.videoWidth;
      let h = tempVideo.videoHeight;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h, 1);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      try {
        canvas.getContext('2d').drawImage(tempVideo, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        tempVideo.remove();
        resolve(dataUrl);
      } catch (e) {
        tempVideo.remove();
        if (videoElement.poster) {
          capturePosterFrame(videoElement.poster).then(resolve).catch(() => {
            reject(new Error('Could not capture video frame due to CORS'));
          });
        } else {
          reject(new Error('Could not capture video frame due to CORS'));
        }
      }
    };
  };
  
  tempVideo.onerror = () => {
    clearTimeout(videoTimeout);
    tempVideo.remove();
    if (videoElement.poster) {
      capturePosterFrame(videoElement.poster).then(resolve).catch(() => {
        reject(new Error('Failed to load video and poster fallback also failed'));
      });
    } else {
      reject(new Error('Failed to load video and no poster available'));
    }
  };
  
  tempVideo.src = videoSrc;
  tempVideo.load();
}



// ============================================
// BULK SELECTION
// ============================================

let bulkModeEnabled = false;

function toggleBulkMode() {
  bulkModeEnabled = !bulkModeEnabled;
  
  const btn = document.getElementById('asmg-btn-bulk');
  if (btn) {
    btn.classList.toggle('secondary', !bulkModeEnabled);
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = '☑';
    btn.append(icon);
    if (bulkModeEnabled) {
      const countSpan = document.createElement('span');
      countSpan.textContent = 'Bulk (';
      const countInner = document.createElement('span');
      countInner.id = 'asmg-bulk-count';
      countInner.textContent = '0';
      countSpan.append(countInner, document.createTextNode(')'));
      btn.append(countSpan);
    } else {
      btn.append(document.createTextNode(' Bulk Select'));
    }
  }
  
  if (bulkModeEnabled) {
    enableBulkMode();
  } else {
    disableBulkMode();
  }
}

function enableBulkMode() {
  state.selectedItems.clear();
  
  const items = document.querySelectorAll(CONFIG.selectors.uploadItem);
  
  items.forEach((item, index) => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'asmg-bulk-checkbox visible';
    checkbox.dataset.index = index;
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedItems.add(index);
      } else {
        state.selectedItems.delete(index);
      }
      updateBulkCount();
    });
    
    item.style.position = 'relative';
    item.prepend(checkbox);
  });
  
  const toolbar = createEl('div', { id: 'asmg-bulk-toolbar', className: 'asmg-bulk-toolbar', style: 'position:fixed;top:60px;right:20px;z-index:999999;width:300px;' });
  
  const btnSelectAll = createEl('button', { id: 'asmg-select-all', textContent: 'Select All' });
  const btnDeselectAll = createEl('button', { id: 'asmg-deselect-all', textContent: 'Deselect All' });
  const btnGenerate = createEl('button', { id: 'asmg-generate-bulk', className: 'primary', textContent: 'Generate for Selected' });
  const countSpan = createEl('span', { className: 'count' });
  const countInner = createEl('span', { id: 'asmg-bulk-count', textContent: '0' });
  countSpan.append(countInner, document.createTextNode(' selected'));
  
  toolbar.append(btnSelectAll, btnDeselectAll, btnGenerate, countSpan);
  document.body.appendChild(toolbar);
  
  document.getElementById('asmg-select-all').addEventListener('click', () => {
    document.querySelectorAll('.asmg-bulk-checkbox').forEach((cb, i) => {
      cb.checked = true;
      state.selectedItems.add(i);
    });
    updateBulkCount();
  });
  
  document.getElementById('asmg-deselect-all').addEventListener('click', () => {
    document.querySelectorAll('.asmg-bulk-checkbox').forEach(cb => cb.checked = false);
    state.selectedItems.clear();
    updateBulkCount();
  });
  
  document.getElementById('asmg-generate-bulk').addEventListener('click', processBulkSelection);
}

function disableBulkMode() {
  document.querySelectorAll('.asmg-bulk-checkbox').forEach(cb => cb.remove());
  const toolbar = document.getElementById('asmg-bulk-toolbar');
  if (toolbar) toolbar.remove();
  state.selectedItems.clear();
}

function updateBulkCount() {
  const countEl = document.getElementById('asmg-bulk-count');
  if (countEl) countEl.textContent = state.selectedItems.size;
}

async function processBulkSelection() {
  if (state.selectedItems.size === 0) {
    showStatus('No items selected', 'error');
    return;
  }
  
  const items = document.querySelectorAll(CONFIG.selectors.uploadItem);
  const selectedIndices = Array.from(state.selectedItems).sort((a, b) => a - b);
  
  showStatus(`Processing ${selectedIndices.length} items...`, 'analyzing');
  
  const progressContainer = createEl('div', { id: 'asmg-bulk-progress', style: 'position:fixed;top:50px;right:20px;z-index:999999;width:300px;background:white;border-radius:8px;padding:8px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.15);' });
  const progressDiv = createEl('div', { className: 'asmg-progress' });
  const fillDiv = createEl('div', { className: 'fill', style: 'width:0%' });
  progressDiv.append(fillDiv);
  const labelDiv = createEl('div', { style: 'font-size:11px;color:#888;margin-top:4px;text-align:center;', textContent: `0 / ${selectedIndices.length}` });
  progressContainer.append(progressDiv, labelDiv);
  document.body.appendChild(progressContainer);
  
  const fill = progressContainer.querySelector('.fill');
  const label = progressContainer.querySelector('div:last-child');
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < selectedIndices.length; i++) {
    const index = selectedIndices[i];
    const item = items[index];
    
    const percent = ((i + 1) / selectedIndices.length) * 100;
    fill.style.width = percent + '%';
    label.textContent = `${i + 1} / ${selectedIndices.length} (${successCount} ok, ${failCount} failed)`;
    
    // Detect if this is a video item
    const vid = item.querySelector(CONFIG.selectors.videoInItem);
    const isVideoItem = vid && vid.tagName === 'VIDEO';
    
    if (isVideoItem) {
      // Process as video
      try {
        const dataUrl = await captureVideoFrame(vid);
        if (!state.engineReady) await waitForEngine();
        const requestId = ++state.currentRequestId;
        const results = await sendForAnalysis(dataUrl, requestId, true);
        await applyMetadata(results, item);
        successCount++;
      } catch (error) {
        log('Bulk video error:', error);
        failCount++;
      }
      continue;
    }
    
    const img = item.querySelector(CONFIG.selectors.imageInItem) || item.querySelector('img');
    if (!img) { failCount++; continue; }
    
    try {
      const imageUrl = getImageUrl(img);
      if (imageUrl) {
        if (!state.engineReady) await waitForEngine();
        const requestId = ++state.currentRequestId;
        const results = await sendForAnalysis(imageUrl, requestId, false);
        await applyMetadata(results, item);
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      log('Bulk item error:', error);
      failCount++;
    }
  }
  
  progressContainer.remove();
  disableBulkMode();
  showStatus(`Bulk complete! ${successCount} items done (${failCount} failed)`, 'ready');
}

// ============================================
// PAGE OBSERVATION
// ============================================

let observer = null;

function observePageChanges() {
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node.matches) {
            if (node.matches(CONFIG.selectors.uploadItem) || node.querySelector(CONFIG.selectors.uploadItem)) {
              if (bulkModeEnabled) {
                disableBulkMode();
                enableBulkMode();
              }
              return;
            }
          }
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================
// MESSAGE HANDLING
// ============================================

function setupMessageListeners() {
  // From background/popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SETTINGS_UPDATED':
        state.settings = message.settings;
        sendResponse({ received: true });
        break;
      case 'TOGGLE_ANALYSIS':
        analyzeVisibleImage();
        sendResponse({ toggled: true });
        break;
      case 'TOGGLE_BULK_MODE':
        toggleBulkMode();
        sendResponse({ toggled: true });
        break;
      case 'TOGGLE_PANEL':
        togglePanel();
        sendResponse({ toggled: true });
        break;
      case 'PING_ENGINE':
        sendResponse({ ready: state.engineReady });
        break;
    }
  });
  
  // From analysis iframe
  window.addEventListener('message', (event) => {
    if (event.data.type === 'ANALYSIS_ENGINE_READY') {
      state.engineReady = true;
      log('Analysis engine ready');
    } else if (event.data.type === 'PONG') {
      state.engineReady = event.data.ready;
      log('Engine: ' + (event.data.ready ? 'ready' : 'loading'));
    } else if (event.data.type === 'ANALYSIS_ENGINE_ERROR') {
      state.engineReady = false;
      log('Engine error:', event.data.error);
    }
  });
  
  // Custom event from panel
  window.addEventListener('asmg-apply-metadata', () => {
    const cached = state.resultsCache.get('latest');
    if (cached) applyMetadata(cached, null);
  });
}

// ============================================
// SETTINGS
// ============================================

async function getSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    return result.settings || {
      autoAnalyze: false,
      generateTitle: true,
      generateKeywords: true,
      autoSelectCategory: true,
      keywordCount: 47,
      bulkSelectEnabled: true,
      showAnalysisPanel: true
    };
  } catch (error) {
    return {};
  }
}

// ============================================
// UTILITIES
// ============================================

function log(...args) {
  if (CONFIG.debug) console.log('[ASMG]', ...args);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function getColorNameSimple(r, g, b) {
  const colors = {
    'red': [200,0,0], 'green': [0,150,0], 'blue': [0,0,200],
    'yellow': [200,200,0], 'orange': [200,100,0], 'purple': [100,0,150],
    'pink': [200,100,150], 'brown': [100,50,30], 'gray': [128,128,128],
    'white': [240,240,240], 'black': [30,30,30], 'teal': [0,128,128],
    'cyan': [0,200,200], 'gold': [255,215,0]
  };
  let closest = 'colorful';
  let minDist = Infinity;
  for (const [name, [nr, ng, nb]] of Object.entries(colors)) {
    const dist = Math.sqrt(Math.pow(r-nr,2)+Math.pow(g-ng,2)+Math.pow(b-nb,2));
    if (dist < minDist) { minDist = dist; closest = name; }
  }
  return closest;
}

// ============================================
// BOOTSTRAP
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
