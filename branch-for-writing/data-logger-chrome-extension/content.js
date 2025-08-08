console.log('Keystroke Logger: Content script loaded');
console.log('URL:', window.location.href);
console.log('Hostname:', window.location.hostname);

// Platform detection (do this first before initializing anything)
const PLATFORM = {
  GOOGLE_DOCS: 'google_docs',
  CHATGPT: 'chatgpt',
  UNKNOWN: 'unknown'
};

function detectPlatform() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  if (hostname.includes('docs.google.com') && pathname.includes('/document/')) {
    return PLATFORM.GOOGLE_DOCS;
  } else if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    return PLATFORM.CHATGPT;
  }
  
  return PLATFORM.UNKNOWN;
}

const currentPlatform = detectPlatform();
console.log('Platform detected:', currentPlatform);

// Initialize diff-match-patch only for Google Docs
let dmp = null;
if (currentPlatform === PLATFORM.GOOGLE_DOCS) {
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

// Configuration
const CONFIG = {
  API_URL: 'http://localhost:3000/api/keystroke-logs', // ✅ Correct API URL
  BATCH_SIZE: 5,  // Send every 5 edits for real-time tracking
  SEND_INTERVAL: 15000, // Send remaining batch every 15 seconds
  SESSION_ID: 'Drafting_' + Date.now(), // Unique session ID
  USER_ID: null, // Will be set from storage or generated
  DOC_ID: null   // Will be extracted from URL
};

// State management
let state = {
  lastText: '',
  batch: [],
  isInitialized: false,
  cursorPosition: 0,
  keystrokeCount: 0
};

// Extract Google Doc ID from URL
function extractDocId() {
  const match = window.location.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : 'unknown_doc';
}

// Request text from injected extractor via postMessage
function getEditorTextViaMessaging(timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const requestId = generateId();
      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== 'DOCS_TEXT_RESULT' || data.requestId !== requestId) return;
        window.removeEventListener('message', onMessage);
        resolve(typeof data.text === 'string' ? data.text : '');
      };
      window.addEventListener('message', onMessage);
      window.postMessage({ type: 'EXTRACT_DOCS_TEXT', requestId }, '*');
      setTimeout(() => {
        try { window.removeEventListener('message', onMessage); } catch (_) {}
        resolve('');
      }, timeoutMs);
    } catch (e) {
      resolve('');
    }
  });
}

// Get current editor text (tries messaging first, then iframe closure method)
async function getEditorText() {
  try {
    console.log('Extension: Attempting text extraction...');

    // Method 1: Ask injected page script via postMessage
    const msgResult = await getEditorTextViaMessaging();
    if (msgResult && msgResult.length > 0) {
      console.log('Extension: Messaging extractor success:', msgResult.length, 'chars');
      return msgResult;
    }
    
    // Method 2: Direct iframe closure method (proven to work)
    const iframe = document.querySelector('.docs-texteventtarget-iframe');
    console.log('Extension: Iframe found:', !!iframe);
    
    if (iframe && iframe.contentDocument) {
      console.log('Extension: Iframe document accessible');
      const doc = iframe.contentDocument;
      const closureKey = Object.keys(doc).find(k => k.startsWith('closure_'));
      console.log('Extension: Closure key:', closureKey);
      
      if (closureKey) {
        console.log('Extension: Attempting dig operation...');
        const result = digText(doc[closureKey], new Set()) || '';
        console.log('Extension: Dig result length:', result.length);
        
        if (result.length > 0) {
          console.log('Extension: Direct iframe extraction success');
          return result;
        }
      }
    } else {
      console.log('Extension: Iframe not accessible');
    }
    
    console.log('Extension: All text extraction methods failed');
    return '';
  } catch (error) {
    console.log('Extension: Text extraction error:', error);
    return '';
  }
}

// Dig function to extract text from Google's closure objects
function digText(src, seen) {
  if (!src || seen.has(src)) return '';
  seen.add(src);
  
  const values = Array.isArray(src) ? src : Object.values(src);
  
  for (const v of values) {
    try {
      if (typeof v === 'string' && v.length > 1 && v[0] === '\x03' && v.endsWith('\n')) {
        return v.substring(1, v.length - 1); // Remove \x03 and \n
      } else if (typeof v === 'object' && v !== null) {
        const result = digText(v, seen);
        if (result) return result;
      }
    } catch (e) {
      continue;
    }
  }
  return '';
}

// Manual test function for debugging (accessible from console)
window.testExtensionTextExtraction = function() {
  console.log('=== TESTING EXTENSION TEXT EXTRACTION ===');
  console.log('Extension loaded:', typeof getEditorText !== 'undefined');
  
  if (typeof getEditorText !== 'undefined') {
    Promise.resolve(getEditorText()).then((result) => {
      console.log('Extension extraction result length:', result.length);
      console.log('Result preview:', result.substring(0, 100));
    });
  } else {
    console.log('Extension getEditorText function not available');
  }
};

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Determine action type based on diff results
function determineActionType(diffs, beforeLength, afterLength) {
  if (diffs.length === 0) return 'no_change';
  
  // Check for paste operation (large insertion)
  const insertions = diffs.filter(d => d[0] === 1);
  const deletions = diffs.filter(d => d[0] === -1);
  
  if (insertions.length === 1 && insertions[0][1].length > 10) {
    return 'paste';
  }
  
  if (afterLength > beforeLength) {
    return insertions.length > 0 ? 'insert' : 'replace';
  } else if (afterLength < beforeLength) {
    return deletions.length > 0 ? 'delete' : 'replace';
  }
  
  return 'replace';
}

// ======== CHATGPT CONVERSATION MONITORING ========

// Track processed messages to avoid duplicates
const processedMessages = new Set();

// Extract message data from ChatGPT article
function extractChatGPTMessage(article) {
  try {
    // Get message ID to avoid duplicates
    const messageElement = article.querySelector('[data-message-id]');
    const messageId = messageElement?.getAttribute('data-message-id');
    if (!messageId || processedMessages.has(messageId)) {
      return null;
    }
    
    // Determine sender
    const authorRole = messageElement?.getAttribute('data-message-author-role');
    let sender = 'unknown';
    if (authorRole === 'user') {
      sender = 'user';
    } else if (authorRole === 'assistant') {
      sender = 'ai';
    } else {
      // Fallback: check for user message styling
      const userBubble = article.querySelector('.user-message-bubble-color');
      if (userBubble) {
        sender = 'user';
      } else {
        sender = 'ai';
      }
    }
    
    // Extract text content
    let text = '';
    
    // Try to find the main text content
    const textElements = article.querySelectorAll('.whitespace-pre-wrap, [data-message-author-role] .text-base, .prose');
    for (const element of textElements) {
      const content = element.textContent?.trim();
      if (content && content.length > text.length) {
        text = content;
      }
    }
    
    // Fallback: get any text content from the article
    if (!text) {
      text = article.textContent?.trim() || '';
      // Clean up common UI text
      text = text.replace(/Copy.*?$/g, '').replace(/You said:/g, '').replace(/ChatGPT said:/g, '').trim();
    }
    
    if (!text) {
      return null;
    }
    
    const timestamp = new Date().toISOString();
    
    processedMessages.add(messageId);
    
    return {
      messageId,
      sender,
      timestamp,
      text
    };
  } catch (error) {
    console.error('ChatGPT: Error extracting message:', error);
    return null;
  }
}

// Monitor for new ChatGPT messages
function initializeChatGPTMonitoring() {
  console.log('ChatGPT: Initializing conversation monitoring...');
  console.log('ChatGPT: DOM readyState:', document.readyState);
  console.log('ChatGPT: Body element:', !!document.body);
  
  // Process existing messages
  const existingArticles = document.querySelectorAll('article[data-testid*="conversation-turn"]');
  console.log(`ChatGPT: Found ${existingArticles.length} existing messages`);
  
  existingArticles.forEach(article => {
    const messageData = extractChatGPTMessage(article);
    if (messageData) {
      console.log('ChatGPT: Existing message -', messageData);
    }
  });
  
  // Set up MutationObserver to watch for new messages
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node is an article or contains articles
          let articles = [];
          
          if (node.matches && node.matches('article[data-testid*="conversation-turn"]')) {
            articles = [node];
          } else if (node.querySelectorAll) {
            articles = node.querySelectorAll('article[data-testid*="conversation-turn"]');
          }
          
          articles.forEach(article => {
            // Add a small delay to ensure the content is fully rendered
            setTimeout(() => {
              const messageData = extractChatGPTMessage(article);
              if (messageData) {
                console.log('ChatGPT: New message -', messageData);
              }
            }, 100);
          });
        }
      });
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('ChatGPT: Monitoring initialized successfully');
}

// Manual test function for ChatGPT debugging (accessible from console)
window.testChatGPTExtraction = function() {
  console.log('=== TESTING CHATGPT MESSAGE EXTRACTION ===');
  
  const articles = document.querySelectorAll('article[data-testid*="conversation-turn"]');
  console.log(`Found ${articles.length} conversation articles`);
  
  articles.forEach((article, index) => {
    console.log(`\n--- Article ${index + 1} ---`);
    const messageData = extractChatGPTMessage(article);
    if (messageData) {
      console.log('✅ Extracted message:', messageData);
    } else {
      console.log('❌ Failed to extract message from this article');
      console.log('Article HTML preview:', article.outerHTML.substring(0, 200) + '...');
    }
  });
  
  console.log('\n=== TEST COMPLETE ===');
};

// Initialize user ID from storage or generate new one
async function initializeUserId() {
  try {
    const result = await chrome.storage.local.get(['keystroke_logger_user_id']);
    if (result.keystroke_logger_user_id) {
      CONFIG.USER_ID = result.keystroke_logger_user_id;
    } else {
      CONFIG.USER_ID = 'user_' + generateId();
      await chrome.storage.local.set({keystroke_logger_user_id: CONFIG.USER_ID});
    }
    console.log('Extension: User ID initialized:', CONFIG.USER_ID);
  } catch (error) {
    console.error('Error initializing user ID:', error);
    CONFIG.USER_ID = 'user_' + generateId();
  }
}

// Create log entry from text change
function createLogEntry(beforeText, afterText) {
  if (!dmp) {
    console.error('diff_match_patch not available');
    return null;
  }
  
  const timestamp = new Date().toISOString();
  const diffs = dmp.diff_main(beforeText, afterText);
  dmp.diff_cleanupSemantic(diffs);
  
  const actionType = determineActionType(diffs, beforeText.length, afterText.length);
  
  return {
    id: generateId(),
    doc_id: CONFIG.DOC_ID,
    user_id: CONFIG.USER_ID,
    session_id: CONFIG.SESSION_ID,
    timestamp: timestamp,
    before_text: beforeText,
    after_text: afterText,
    diff_data: diffs,
    action_type: actionType,
    cursor_position: 0, // Simplified for now
    text_length_before: beforeText.length,
    text_length_after: afterText.length,
    keystroke_count: ++state.keystrokeCount
  };
}

// Send batch to server
async function sendBatch() {
  if (state.batch.length === 0) return;
  
  const batchToSend = [...state.batch];
  console.log(`Extension: Sending batch of ${batchToSend.length} entries`);
  
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Extension-Version': '1.0'
      },
      body: JSON.stringify({ logs: batchToSend })
    });
    
    if (response.ok) {
      state.batch = state.batch.slice(batchToSend.length); // Remove sent items
      console.log('Extension: Batch sent successfully');
    } else {
      console.error('Extension: Server error:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Extension: Network error sending batch:', error);
    // Keep the batch for retry
  }
}

// Handle text change
function handleTextChange(currentText) {
  console.log('Extension: Text change detected');
  
  if (!state.isInitialized) return;
  
  if (currentText !== state.lastText) {
    const logEntry = createLogEntry(state.lastText, currentText);
    if (logEntry) {
      state.batch.push(logEntry);
      state.lastText = currentText;
      
      console.log(`Extension: ${logEntry.action_type} - ${logEntry.text_length_after} chars`);
      
      if (state.batch.length >= CONFIG.BATCH_SIZE) {
        sendBatch();
      }
    }
  }
}

// Event handlers setup
function setupEventListeners() {
  // Listen on iframe for Google Docs input
  const iframe = document.querySelector('.docs-texteventtarget-iframe');
  if (iframe && iframe.contentDocument) {
    console.log('Extension: Setting up iframe event listeners');
    
    iframe.contentDocument.addEventListener('keyup', () => {
      setTimeout(async () => {
        const currentText = await getEditorText();
        handleTextChange(currentText);
      }, 500); // Wait for Google Docs to update
    });
    
    iframe.contentDocument.addEventListener('input', () => {
      setTimeout(async () => {
        const currentText = await getEditorText();
        handleTextChange(currentText);
      }, 500);
    });
  }
  
  // Global event listeners as fallback
  document.addEventListener('keyup', () => {
    setTimeout(async () => {
      const currentText = await getEditorText();
      handleTextChange(currentText);
    }, 500);
  });
  
  // Page unload - send remaining batch
  window.addEventListener('beforeunload', () => {
    if (state.batch.length > 0) {
      sendBatch();
    }
  });
  
  console.log('Extension: Event listeners setup complete');
}

// Initialize the logger
async function initialize() {
  console.log('Extension: Initializing...');
  
  CONFIG.DOC_ID = extractDocId();
  await initializeUserId();
  
  // Wait for extractor to be ready
  let attempts = 0;
  const maxAttempts = 20;
  
  const checkReady = async () => {
    const currentText = await getEditorText();
    if (typeof currentText === 'string') {
      state.lastText = currentText;
      state.isInitialized = true;

      setupEventListeners();

      console.log('Extension: Initialized successfully');
      console.log(`Doc ID: ${CONFIG.DOC_ID}, User ID: ${CONFIG.USER_ID}`);
      console.log(`Initial text length: ${currentText.length}`);

      // Start periodic sending
      setInterval(sendBatch, CONFIG.SEND_INTERVAL);

      return true;
    }
    return false;
  };
  
  if (!(await checkReady())) {
    const interval = setInterval(async () => {
      attempts++;
      if ((await checkReady()) || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          console.error('Extension: Failed to initialize - could not extract text');
        }
      }
    }, 500);
  }
}

// Install extractor script
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
      initialize();
    }, 1000);
  };
  script.onerror = () => {
    console.error('Extension: Failed to load extractor script, trying without it');
    initialize();
  };
  
  (document.head || document.documentElement).appendChild(script);
}

// Platform-specific initialization
function initializePlatform() {
  console.log('Initializing for platform:', currentPlatform);
  console.log('Current hostname:', window.location.hostname);
  console.log('Platform constants:', PLATFORM);
  
  switch (currentPlatform) {
    case PLATFORM.GOOGLE_DOCS:
      console.log('Initializing Google Docs keystroke logging...');
      installExtractor();
      break;
      
    case PLATFORM.CHATGPT:
      console.log('Initializing ChatGPT conversation monitoring...');
      try {
        initializeChatGPTMonitoring();
      } catch (error) {
        console.error('Error initializing ChatGPT monitoring:', error);
      }
      break;
      
    default:
      console.log('Unknown platform, skipping initialization');
      console.log('Detected platform value:', currentPlatform);
      break;
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializePlatform, 1000);
  });
} else {
  setTimeout(initializePlatform, 1000);
}