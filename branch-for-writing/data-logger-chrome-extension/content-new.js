// Main Content Script - Data Logger Extension (Non-module version)
console.log('Data Logger Extension: Content script loaded');
console.log('URL:', window.location.href);
console.log('Hostname:', window.location.hostname);

// Global variables
let currentPlatform = null;
let userId = null;
let dmp = null; // diff-match-patch instance for Google Docs

// Initialize diff-match-patch only for Google Docs
async function initializeDMP() {
  if (currentPlatform === window.PlatformDetector.PLATFORM.GOOGLE_DOCS) {
    try {
      const DMPClass = (typeof diff_match_patch !== 'undefined' ? diff_match_patch : undefined) ||
        (typeof window !== 'undefined' && window.diff_match_patch ? window.diff_match_patch : undefined);
      if (typeof DMPClass === 'function') {
        dmp = new DMPClass();
        console.log('diff_match_patch initialized for Google Docs');
      } else {
        console.warn('diff_match_patch not yet available, will retry...');
        let attempts = 0;
        const retry = setInterval(() => {
          attempts++;
          const RetryClass = (typeof diff_match_patch !== 'undefined' ? diff_match_patch : undefined) ||
            (typeof window !== 'undefined' && window.diff_match_patch ? window.diff_match_patch : undefined);
          if (typeof RetryClass === 'function') {
            try {
              dmp = new RetryClass();
              console.log('diff_match_patch initialized on retry');
            } catch (e) {
              console.error('diff_match_patch init error on retry:', e);
            }
            clearInterval(retry);
          } else if (attempts >= 20) {
            console.error('diff_match_patch still unavailable after retries');
            clearInterval(retry);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Failed to initialize diff_match_patch:', error);
    }
  }
}

// Initialize user ID
async function initializeUser() {
  userId = await window.UserManagement.initializeUserId();
  console.log('User ID initialized:', userId);
}

// Platform-specific initialization
async function initializePlatform() {
  console.log('Initializing for platform:', currentPlatform);
  console.log('Current hostname:', window.location.hostname);
  
  // Initialize user ID first
  await initializeUser();
  
  // Initialize DMP for Google Docs
  await initializeDMP();
  
  switch (currentPlatform) {
    case window.PlatformDetector.PLATFORM.GOOGLE_DOCS:
      console.log('Initializing Google Docs keystroke logging...');
      window.GoogleDocsLogger.setupUrlMonitoring();
      await window.GoogleDocsLogger.initializeTab(dmp, userId);
      break;
      
    case window.PlatformDetector.PLATFORM.CHATGPT:
    case window.PlatformDetector.PLATFORM.CLAUDE:
    case window.PlatformDetector.PLATFORM.GEMINI:
      console.log(`Initializing ${currentPlatform} conversation monitoring...`);
      await initializeAIPlatformWithPermission();
      break;
      
    default:
      console.log('Unknown platform, skipping initialization');
      console.log('Detected platform value:', currentPlatform);
      break;
  }
}

// Initialize AI platform with permission check
async function initializeAIPlatformWithPermission() {
  // Check if user has already given permission for this conversation
  const hasPermission = await window.PermissionPopup.checkExistingPermission(currentPlatform);
  
  if (hasPermission) {
    console.log('User has already given permission for this conversation');
    window.AIPlatformLogger.initializeAIPlatformMonitoring(currentPlatform, userId);
  } else {
    console.log('Requesting permission for AI platform logging');
    window.PermissionPopup.createPermissionPopup(currentPlatform, userId, () => {
      console.log('Permission granted, starting AI platform monitoring');
      window.AIPlatformLogger.initializeAIPlatformMonitoring(currentPlatform, userId);
    });
  }
}

// Install extractor script for Google Docs
function installExtractor() {
  console.log('Extension: Installing extractor script...');
  
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('extractor.js');
  script.onload = () => {
    console.log('Extension: Extractor script loaded successfully');
    // Wait a bit for the script to execute and set up window.extractGoogleDocsText
    setTimeout(() => {
      console.log('Extension: Checking if extractor is ready...');
      console.log('Extension: window.extractGoogleDocsText available:', typeof window.extractGoogleDocsText);
      initializePlatform();
    }, 1000);
  };
  script.onerror = () => {
    console.error('Extension: Failed to load extractor script, trying without it');
    initializePlatform();
  };
  
  (document.head || document.documentElement).appendChild(script);
}

// Console debugging functions
window.testExtensionTextExtraction = function() {
  console.log('=== EXTENSION DIAGNOSTICS ===');
  
  // Basic functionality checks
  console.log('1. Extension loaded:', typeof window.GoogleDocsLogger?.getEditorText === 'function');
  console.log('2. DMP available:', !!dmp);
  console.log('3. User ID:', userId);
  console.log('4. Current URL:', window.location.href);
  console.log('5. Platform:', currentPlatform);
  
  // Platform-specific tests
  if (currentPlatform === window.PlatformDetector.PLATFORM.GOOGLE_DOCS) {
    window.GoogleDocsLogger.testGoogleDocsTextExtraction();
  } else if ([window.PlatformDetector.PLATFORM.CHATGPT, window.PlatformDetector.PLATFORM.CLAUDE, window.PlatformDetector.PLATFORM.GEMINI].includes(currentPlatform)) {
    window.AIPlatformLogger.testAIPlatformExtraction(currentPlatform);
  }
};

window.testAIPlatformExtraction = function() {
  window.AIPlatformLogger.testAIPlatformExtraction(currentPlatform);
};

window.testAIMessageSending = function() {
  window.AIPlatformLogger.testAIMessageSending(currentPlatform, userId);
};

window.testGoogleDocsTextExtraction = function() {
  window.GoogleDocsLogger.testGoogleDocsTextExtraction();
};

window.getUserInfo = function() {
  window.UserManagement.getUserInfo(userId);
};

window.resetUserID = function() {
  window.UserManagement.resetUserID();
};

window.exportUserData = function() {
  window.UserManagement.exportUserData(userId, currentPlatform);
};

window.clearAllPermissions = function() {
  window.PermissionPopup.clearAllPermissions();
};

window.debugAIResponseMonitoring = function() {
  window.AIPlatformLogger.debugAIResponseMonitoring(currentPlatform);
};

window.testBackendConnectivity = function() {
  window.AIPlatformLogger.testBackendConnectivity();
};

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      // Detect platform
      currentPlatform = window.PlatformDetector.detectPlatform();
      console.log('Platform detected:', currentPlatform);
      
      if (currentPlatform === window.PlatformDetector.PLATFORM.GOOGLE_DOCS) {
        installExtractor();
      } else {
        initializePlatform();
      }
    }, 1000);
  });
} else {
  setTimeout(() => {
    // Detect platform
    currentPlatform = window.PlatformDetector.detectPlatform();
    console.log('Platform detected:', currentPlatform);
    
    if (currentPlatform === window.PlatformDetector.PLATFORM.GOOGLE_DOCS) {
      installExtractor();
    } else {
      initializePlatform();
    }
  }, 1000);
}
