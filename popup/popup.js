/**
 * Popup Script
 * Controls the extension popup UI and communicates with background/content scripts.
 */

// ============================================
// STATE
// ============================================

let currentSettings = null;
let currentTabId = null;
let engineStatus = {
  tf: 'loading',
  model: 'loading',
  page: 'loading'
};

// Polling interval for engine status
let statusInterval = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  await getCurrentTab();
  
  // Load settings
  await loadSettings();
  
  // Setup UI
  setupUI();    // Check page and engine status
  checkStatus();
  
  // Periodic status check
  statusInterval = setInterval(checkStatus, 5000);
});

/**
 * Get the current active tab
 */
async function getCurrentTab() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      currentTabId = tabs[0].id;
    }
  } catch (error) {
    console.error('Error getting current tab:', error);
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (response && response.settings) {
      currentSettings = response.settings;
      applySettingsToUI();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Apply loaded settings to the UI controls
 */
function applySettingsToUI() {
  if (!currentSettings) return;
  
  document.getElementById('setting-title').checked = currentSettings.generateTitle !== false;
  document.getElementById('setting-keywords').checked = currentSettings.generateKeywords !== false;
  document.getElementById('setting-category').checked = currentSettings.autoSelectCategory !== false;
  document.getElementById('setting-bulk').checked = currentSettings.bulkSelectEnabled !== false;
  document.getElementById('setting-keyword-count').value = currentSettings.keywordCount || 47;
}

// ============================================
// UI SETUP
// ============================================

function setupUI() {
  // Action buttons
  document.getElementById('btn-analyze').addEventListener('click', () => {
    sendToContent('TOGGLE_ANALYSIS');
    window.close();
  });
  
  document.getElementById('btn-generate').addEventListener('click', () => {
    sendToContent('GENERATE_METADATA');
    window.close();
  });
  
  document.getElementById('btn-bulk').addEventListener('click', () => {
    sendToContent('TOGGLE_BULK_MODE');
    window.close();
  });
  
  document.getElementById('btn-panel').addEventListener('click', () => {
    sendToContent('TOGGLE_PANEL');
    window.close();
  });
  
  // Settings toggles
  document.getElementById('setting-title').addEventListener('change', (e) => {
    updateSetting('generateTitle', e.target.checked);
  });
  
  document.getElementById('setting-keywords').addEventListener('change', (e) => {
    updateSetting('generateKeywords', e.target.checked);
  });
  
  document.getElementById('setting-category').addEventListener('change', (e) => {
    updateSetting('autoSelectCategory', e.target.checked);
  });
  
  document.getElementById('setting-bulk').addEventListener('change', (e) => {
    updateSetting('bulkSelectEnabled', e.target.checked);
  });
  
  document.getElementById('setting-keyword-count').addEventListener('change', (e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 5) value = 5;
    if (value > 50) value = 50;
    e.target.value = value;
    updateSetting('keywordCount', value);
  });
  
  // Settings collapse toggle
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsGroup = document.getElementById('settings-group');
  
  settingsToggle.addEventListener('click', () => {
    const isCollapsed = settingsGroup.style.display === 'none';
    settingsGroup.style.display = isCollapsed ? 'flex' : 'none';
    settingsToggle.classList.toggle('collapsed', !isCollapsed);
  });
  
  // Footer links
  document.getElementById('open-settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
  });
  
  document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({
      url: 'https://github.com/your-username/adobe-stock-metadata-generator'
    });
  });
}

// ============================================
// STATUS CHECKING
// ============================================

async function checkStatus() {
  await checkPageConnection();
  await checkEngineStatus();
  updateStatusDisplay();
}

async function checkPageConnection() {
  try {
    if (currentTabId) {
      const response = await browser.tabs.sendMessage(currentTabId, { type: 'PING_ENGINE' });
      engineStatus.page = response && response.ready ? 'ready' : 'waiting';
    } else {
      engineStatus.page = 'waiting';
    }
  } catch (error) {
    engineStatus.page = 'unavailable';
  }
  
  // Check if we're on the right page
  try {
    const tab = await browser.tabs.get(currentTabId);
    if (tab && tab.url) {
      if (!tab.url.includes('contributor.stock.adobe.com')) {
        engineStatus.page = 'wrong_page';
      }
    }
  } catch (error) {
    engineStatus.page = 'unavailable';
  }
}

async function checkEngineStatus() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' });
    if (response) {
      engineStatus.tf = response.tfReady ? 'ready' : 'loading';
      engineStatus.model = response.modelReady ? 'ready' : 'loading';
      console.log('[ASMG Popup] Real engine status:', JSON.stringify(response));
    }
  } catch (error) {
    engineStatus.tf = 'error';
    engineStatus.model = 'error';
    console.error('[ASMG Popup] Engine status check failed:', error.message);
  }
}

function updateStatusDisplay() {
  // Page status
  const pageEl = document.getElementById('page-status');
  if (pageEl) {
    switch (engineStatus.page) {
      case 'ready':
        pageEl.textContent = '✅ Connected';
        pageEl.className = 'engine-check ready';
        break;
      case 'waiting':
        pageEl.textContent = '⏳ Waiting for page...';
        pageEl.className = 'engine-check loading';
        break;
      case 'unavailable':
        pageEl.textContent = '❌ Page not found';
        pageEl.className = 'engine-check error';
        break;
      case 'wrong_page':
        pageEl.textContent = '⚠️ Not on Adobe Stock';
        pageEl.className = 'engine-check error';
        break;
    }
  }
  
  // TF.js status (from background page, not from page)
  const tfStatusEl = document.getElementById('tf-status');
  if (tfStatusEl) {
    switch (engineStatus.tf) {
      case 'ready':
        tfStatusEl.textContent = '✅ TensorFlow.js';
        tfStatusEl.className = 'engine-check ready';
        break;
      case 'loading':
        tfStatusEl.textContent = '⏳ Loading TF...';
        tfStatusEl.className = 'engine-check loading';
        break;
      default:
        tfStatusEl.textContent = '❌ TF not loaded';
        tfStatusEl.className = 'engine-check error';
        break;
    }
  }
  
  // Model status (from background page)
  const modelStatusEl = document.getElementById('model-status');
  if (modelStatusEl) {
    switch (engineStatus.model) {
      case 'ready':
        modelStatusEl.textContent = '✅ MobileNet V1';
        modelStatusEl.className = 'engine-check ready';
        break;
      case 'loading':
        modelStatusEl.textContent = '⏳ Downloading model...';
        modelStatusEl.className = 'engine-check loading';
        break;
      default:
        modelStatusEl.textContent = '❌ Model failed';
        modelStatusEl.className = 'engine-check error';
        break;
    }
  }
  
  // Overall status indicator
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  
  if (dot && text) {
    if (engineStatus.tf === 'ready' && engineStatus.model === 'ready' && engineStatus.page === 'ready') {
      dot.className = 'dot ready';
      text.textContent = 'All Systems Ready';
    } else if (engineStatus.page === 'wrong_page') {
      dot.className = 'dot error';
      text.textContent = 'Open Adobe Stock';
    } else if (engineStatus.model === 'loading' || engineStatus.tf === 'loading') {
      dot.className = 'dot analyzing';
      text.textContent = 'Loading ML Engine...';
    } else if (engineStatus.model === 'error' || engineStatus.tf === 'error') {
      dot.className = 'dot error';
      text.textContent = 'Engine Error';
    } else {
      dot.className = 'dot error';
      text.textContent = 'Waiting...';
    }
  }
}

// ============================================
// COMMUNICATION
// ============================================

/**
 * Send a message to the content script in the current tab
 */
async function sendToContent(type, data = {}) {
  if (!currentTabId) {
    console.error('No active tab');
    return;
  }
  
  try {
    await browser.tabs.sendMessage(currentTabId, { type, ...data });
  } catch (error) {
    console.error('Error sending to content script:', error);
    
    // Try sending via background
    try {
      await browser.runtime.sendMessage({ 
        type: 'FORWARD_TO_CONTENT',
        tabId: currentTabId,
        message: { type, ...data }
      });
    } catch (e2) {
      console.error('Error forwarding message:', e2);
    }
  }
}

/**
 * Update a single setting
 */
async function updateSetting(key, value) {
  if (!currentSettings) currentSettings = {};
  currentSettings[key] = value;
  
  try {
    await browser.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: { [key]: value }
    });
  } catch (error) {
    console.error('Error updating setting:', error);
  }
}
