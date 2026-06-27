/**
 * Background Event Page
 * 
 * Coordinates between popup, content script, and analysis engine.
 * Manages extension state and settings.
 * 
 * Runs as a Firefox Event Page (non-persistent).
 * Uses storage API to persist state across unloads.
 */

// Default settings
const DEFAULT_SETTINGS = {
  autoAnalyze: false,
  generateTitle: true,
  generateKeywords: true,
  autoSelectCategory: true,
  keywordCount: 47,
  bulkSelectEnabled: true,
  showAnalysisPanel: true,
  analysisEngineReady: false
};

/**
 * Initialize storage with default settings
 */
async function initSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    if (!result.settings) {
      await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
}

/**
 * Get settings from storage
 */
async function getSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update settings
 */
async function updateSettings(updates) {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await browser.storage.local.set({ settings: updated });
  return updated;
}

// Initialize on install
browser.runtime.onInstalled.addListener(() => {
  initSettings();
});

/**
 * Handle messages from content script and popup
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      getSettings().then(settings => sendResponse({ settings }));
      return true; // Keep channel open for async response

    case 'UPDATE_SETTINGS':
      updateSettings(message.settings).then(settings => {
        // Broadcast settings change to all tabs
        browser.tabs.query({ url: 'https://contributor.stock.adobe.com/*' }).then(tabs => {
          tabs.forEach(tab => {
            browser.tabs.sendMessage(tab.id, {
              type: 'SETTINGS_UPDATED',
              settings
            }).catch(() => {}); // Ignore errors for tabs that don't have content script
          });
        });
        sendResponse({ settings });
      });
      return true; // Keep channel open for async response

    case 'ANALYZE_IMAGE':
      // Forward analysis request to the tab's content script
      browser.tabs.sendMessage(message.tabId || sender.tab.id, {
        type: 'ANALYZE_IMAGE_REQUEST',
        imageIndex: message.imageIndex,
        requestId: message.requestId
      }).then(response => {
        sendResponse(response);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true;

    case 'ANALYSIS_RESULT_FORWARD':
      // Forward analysis results back to popup
      if (message.popupPort) {
        message.popupPort.postMessage({
          type: 'ANALYSIS_COMPLETE',
          results: message.results,
          requestId: message.requestId
        });
      }
      break;

    case 'OPEN_OPTIONS':
      browser.runtime.openOptionsPage();
      break;

    case 'GET_ENGINE_STATUS':
      // Check if the analysis engine is ready in a tab
      browser.tabs.sendMessage(message.tabId, {
        type: 'PING_ENGINE'
      }).then(response => {
        sendResponse({ ready: response && response.ready });
      }).catch(() => {
        sendResponse({ ready: false });
      });
      return true;

    default:
      console.warn('Unknown message type:', message.type);
      break;
  }
});

/**
 * Handle keyboard shortcuts (if any are configured)
 */
browser.commands?.onCommand?.addListener((command) => {
  if (command === 'toggle-analysis') {
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_ANALYSIS' });
      }
    });
  }
});

console.log('Adobe Stock Metadata Generator background script loaded');
