/**
 * Background Service Worker for Keystroke Logger
 * Handles extension lifecycle and provides utility functions
 */

console.log('Keystroke Logger: Background script loaded');

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Keystroke Logger: Extension installed/updated', details);
  
  if (details.reason === 'install') {
    // First time installation
    chrome.storage.local.set({
      'keystroke_logger_enabled': true,
      'keystroke_logger_install_date': new Date().toISOString()
    });
    
    console.log('Keystroke Logger: First time installation completed');
  } else if (details.reason === 'update') {
    console.log('Keystroke Logger: Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Message handling between content script and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Keystroke Logger: Message received in background:', message);
  
  switch (message.type) {
    case 'GET_EXTENSION_ID':
      sendResponse({ extensionId: chrome.runtime.id });
      break;
      
    case 'LOG_ERROR':
      console.error('Keystroke Logger Error from content script:', message.error);
      break;
      
    case 'BATCH_SENT':
      console.log('Keystroke Logger: Batch sent successfully', message.count);
      break;
      
    case 'GET_SETTINGS':
      chrome.storage.local.get(['keystroke_logger_enabled', 'keystroke_logger_api_url'], (result) => {
        sendResponse(result);
      });
      return true; // Indicates asynchronous response
      
    default:
      console.log('Keystroke Logger: Unknown message type:', message.type);
  }
});

// Tab update listener to reinitialize on Google Docs navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.includes('docs.google.com/document/')) {
    
    console.log('Keystroke Logger: Google Docs page loaded, injecting content script');
    
    // Optional: You can inject content script manually here if needed
    // chrome.scripting.executeScript({
    //   target: { tabId: tabId },
    //   files: ['content.js']
    // });
  }
});

// Note: Removed alarms functionality to avoid permission requirements

// Handle extension suspension/resume
chrome.runtime.onSuspend.addListener(() => {
  console.log('Keystroke Logger: Extension suspending');
});

chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('Keystroke Logger: Extension suspend canceled');
});

// Utility function to get extension status
function getExtensionStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['keystroke_logger_enabled'], (result) => {
      resolve({
        enabled: result.keystroke_logger_enabled !== false,
        version: chrome.runtime.getManifest().version,
        id: chrome.runtime.id
      });
    });
  });
}

// Export status function for debugging
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getExtensionStatus };
}