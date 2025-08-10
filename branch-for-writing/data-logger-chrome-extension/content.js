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
  BATCH_SIZE: 10,  // Increased from 5 to 10 for better efficiency
  SEND_INTERVAL: 10000, // Reduced from 15000 to 10000 for more frequent sends
  SESSION_ID: 'Drafting_' + Date.now(), // Unique session ID
  USER_ID: null, // Will be set from storage or generated
  DOC_ID: null,   // Will be extracted from URL
  TAB_ID: null    // Will be extracted from URL
};

// Multi-tab state management - each tab has its own state
let tabStates = new Map();

// Get or create state for current tab
function getCurrentTabState() {
  const tabId = getDocumentTabId();
  
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, {
      lastText: '',
      batch: [],
      isInitialized: false,
      cursorPosition: 0,
      keystrokeCount: 0,
      lastSendTime: 0,
      sendTimeout: null,
      tabId: tabId
    });
  }
  
  return tabStates.get(tabId);
}

// Legacy state object that delegates to current tab
let state = new Proxy({}, {
  get(target, prop) {
    const currentState = getCurrentTabState();
    return currentState[prop];
  },
  set(target, prop, value) {
    const currentState = getCurrentTabState();
    currentState[prop] = value;
    return true;
  }
});

// Extract Google Doc ID and Tab ID from URL
function extractDocInfo() {
  const docMatch = window.location.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/);
  const docId = docMatch ? docMatch[1] : 'unknown_doc';
  
  // Extract tab ID from URL hash or search params
  let tabId = 'main';
  
  // Check URL hash for tab info
  if (window.location.hash && window.location.hash.includes('tab=')) {
    const hashMatch = window.location.hash.match(/tab=([^&]+)/);
    if (hashMatch) {
      tabId = hashMatch[1];
    }
  }
  
  // Check search params for tab info
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('tab')) {
    tabId = urlParams.get('tab');
  }
  
  return { docId, tabId };
}

// Get unique document+tab identifier
function getDocumentTabId() {
  const { docId, tabId } = extractDocInfo();
  return `${docId}_${tabId}`;
}

// Request text from injected extractor via postMessage with tab awareness
function getEditorTextViaMessaging(timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const requestId = generateId();
      const { tabId } = extractDocInfo();
      
      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.type !== 'DOCS_TEXT_RESULT' || data.requestId !== requestId) return;
        window.removeEventListener('message', onMessage);
        resolve(typeof data.text === 'string' ? data.text : '');
      };
      
      window.addEventListener('message', onMessage);
      
      // Send tab ID to the extractor
      window.postMessage({ 
        type: 'EXTRACT_DOCS_TEXT', 
        requestId,
        tabId: tabId 
      }, '*');
      
      setTimeout(() => {
        try { window.removeEventListener('message', onMessage); } catch (_) {}
        resolve('');
      }, timeoutMs);
    } catch (e) {
      resolve('');
    }
  });
}

// Get current editor text - simplified and reliable approach
async function getEditorText() {
  try {
    const { tabId } = extractDocInfo();
    console.log(`Extension: Attempting text extraction for tab ${tabId}...`);

    // Method 1: Ask injected page script via postMessage (most reliable)
    const msgResult = await getEditorTextViaMessaging();
    if (msgResult && msgResult.length > 0) {
      console.log('Extension: Messaging extractor success:', msgResult.length, 'chars');
      return msgResult;
    }
    
    // Method 2: Direct iframe closure method (proven to work)
    const iframe = document.querySelector('.docs-texteventtarget-iframe');
    if (iframe && iframe.contentDocument) {
      console.log('Extension: Trying iframe closure extraction...');
      const doc = iframe.contentDocument;
      const closureKey = Object.keys(doc).find(k => k.startsWith('closure_'));
      
      if (closureKey) {
        const result = digText(doc[closureKey], new Set()) || '';
        if (result.length > 0) {
          console.log('Extension: Iframe closure extraction success:', result.length, 'chars');
          return result;
        }
      }
    }
    
    // Method 3: Simple DOM extraction (fallback)
    const editorArea = document.querySelector('.kix-appview-editor');
    if (editorArea) {
      const textContent = editorArea.innerText || editorArea.textContent || '';
      if (textContent.trim().length > 0) {
        console.log('Extension: DOM extraction success:', textContent.length, 'chars');
        return textContent.trim();
      }
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

// Get cursor position from Google Docs with improved detection
function getCursorPosition() {
  try {
    // Method 1: Try to get selection from current active page/tab
    const activePage = document.querySelector('.kix-page-paginated, .kix-page');
    if (activePage) {
      const selection = document.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Calculate text position more accurately
        const startContainer = range.startContainer;
        let textPosition = range.startOffset;
        
        // Walk backwards through text nodes to get absolute position
        const walker = document.createTreeWalker(
          activePage,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let currentNode;
        let totalPosition = 0;
        
        while (currentNode = walker.nextNode()) {
          if (currentNode === startContainer) {
            return totalPosition + textPosition;
          }
          totalPosition += currentNode.textContent.length;
        }
        
        return textPosition;
      }
    }
    
    // Method 2: Try iframe approach for legacy support
    const iframe = document.querySelector('.docs-texteventtarget-iframe');
    if (iframe && iframe.contentDocument) {
      const selection = iframe.contentDocument.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return range.startOffset;
      }
    }
    
    // Method 3: Fallback to state
    return state.cursorPosition;
  } catch (error) {
    console.log('Extension: Error getting cursor position:', error);
    return null;
  }
}

// Calculate cursor position from diff data (fallback method)
function calculateCursorFromDiffs(diffs, beforeText) {
  try {
    let position = 0;
    let foundChange = false;
    
    for (const diff of diffs) {
      const [operation, text] = diff;
      
      if (operation === 0) { // EQUAL - move position forward
        position += text.length;
      } else if (operation === 1) { // INSERT - this is likely where cursor is
        foundChange = true;
        position += text.length; // Cursor after insertion
        break;
      } else if (operation === -1) { // DELETE - cursor is at deletion point
        foundChange = true;
        break;
      }
    }
    
    return foundChange ? position : null;
  } catch (error) {
    console.log('Extension: Error calculating cursor from diffs:', error);
    return null;
  }
}

// Manual test function for debugging (accessible from console)
window.testExtensionTextExtraction = function() {
  console.log('=== TESTING EXTENSION TEXT EXTRACTION ===');
  console.log('Extension loaded:', typeof getEditorText !== 'undefined');
  console.log('Current tab ID:', extractDocInfo().tabId);
  
  if (typeof getEditorText !== 'undefined') {
    Promise.resolve(getEditorText()).then((result) => {
      console.log('Extension extraction result length:', result.length);
      console.log('Result preview:', result.substring(0, 100));
      
      // Also test state and initialization
      console.log('Current tab state:', getCurrentTabState());
      console.log('Is initialized:', state.isInitialized);
      console.log('Last text length:', state.lastText.length);
    });
  } else {
    console.log('Extension getEditorText function not available');
  }
};

// Manual test function for cursor position (accessible from console)
window.testCursorPosition = function() {
  console.log('=== TESTING CURSOR POSITION ===');
  console.log('Current state cursor position:', state.cursorPosition);
  
  const directCursor = getCursorPosition();
  console.log('Direct cursor position:', directCursor);
  
  // Test with current text
  Promise.resolve(getEditorText()).then((currentText) => {
    if (currentText && state.lastText) {
      const diffs = dmp ? dmp.diff_main(state.lastText, currentText) : null;
      if (diffs) {
        const calculatedCursor = calculateCursorFromDiffs(diffs, state.lastText);
        console.log('Calculated cursor from diffs:', calculatedCursor);
      }
    }
    
    // Show selection info
    const iframe = document.querySelector('.docs-texteventtarget-iframe');
    if (iframe && iframe.contentDocument) {
      const selection = iframe.contentDocument.getSelection();
      console.log('Iframe selection:', {
        rangeCount: selection.rangeCount,
        isCollapsed: selection.isCollapsed,
        anchorOffset: selection.anchorOffset,
        focusOffset: selection.focusOffset
      });
    }
    
    const mainSelection = document.getSelection();
    console.log('Main document selection:', {
      rangeCount: mainSelection.rangeCount,
      isCollapsed: mainSelection.isCollapsed,
      anchorOffset: mainSelection.anchorOffset,
      focusOffset: mainSelection.focusOffset
    });
  });
};

// Manual test function for multi-tab functionality (accessible from console)
window.testMultiTab = function() {
  console.log('=== TESTING MULTI-TAB FUNCTIONALITY ===');
  
  const { docId, tabId } = extractDocInfo();
  console.log('Current URL:', window.location.href);
  console.log('Current document info:', { docId, tabId });
  console.log('Document+Tab ID:', getDocumentTabId());
  
  console.log('\n--- Tab States ---');
  if (tabStates.size === 0) {
    console.log('No tab states found!');
  } else {
    tabStates.forEach((state, key) => {
      console.log(`  Tab ${key}:`, {
        isInitialized: state.isInitialized,
        textLength: state.lastText.length,
        batchSize: state.batch.length,
        keystrokeCount: state.keystrokeCount
      });
    });
  }
  
  console.log('\n--- Current Tab State ---');
  console.log('Current tab state:', getCurrentTabState());
  
  console.log('\n--- Text Extraction Test ---');
  // Test text extraction for current tab
  Promise.resolve(getEditorText()).then((text) => {
    console.log('Text extraction result:', {
      length: text.length,
      preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });
  });
  
  console.log('\n--- Page Detection ---');
  // Test page detection
  const allPages = document.querySelectorAll('.kix-page-paginated, .kix-page');
  console.log('Total detected pages:', allPages.length);
  let visiblePages = 0;
  allPages.forEach((page, index) => {
    const style = window.getComputedStyle(page);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
    const pageText = page.innerText || page.textContent || '';
    console.log(`  Page ${index}:`, {
      chars: pageText.length,
      visible: isVisible,
      preview: pageText.substring(0, 50) + (pageText.length > 50 ? '...' : '')
    });
    if (isVisible) visiblePages++;
  });
  console.log(`Visible pages: ${visiblePages}/${allPages.length}`);
  
  console.log('\n--- Editor Container Detection ---');
  const editorContainer = document.querySelector('.kix-appview-editor-container');
  console.log('Editor container found:', !!editorContainer);
  if (editorContainer) {
    const textElements = editorContainer.querySelectorAll('.kix-wordhtmlgenerator-word-node, .kix-lineview-text-block, .kix-paragraphrenderer');
    console.log('Text elements in editor:', textElements.length);
  }
  
  console.log('\n--- URL Parameter Analysis ---');
  const urlParams = new URLSearchParams(window.location.search);
  console.log('URL search params:');
  for (const [key, value] of urlParams.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  
  console.log('URL hash:', window.location.hash);
};

// Manual function to force tab reinitialization (accessible from console)
window.forceTabReinit = function() {
  console.log('=== FORCING TAB REINITIALIZATION ===');
  const { docId, tabId } = extractDocInfo();
  console.log(`Forcing reinitialization for tab: ${tabId}`);
  
  // Clear current tab state
  if (tabStates.has(getDocumentTabId())) {
    const oldState = tabStates.get(getDocumentTabId());
    console.log('Clearing old state:', {
      wasInitialized: oldState.isInitialized,
      hadText: oldState.lastText.length > 0,
      batchSize: oldState.batch.length
    });
    tabStates.delete(getDocumentTabId());
  }
  
  // Force reinitialization
  handleTabChange(tabId);
  
  setTimeout(() => {
    console.log('Reinitialization completed. New state:', getCurrentTabState());
  }, 2000);
};

// Debug function to test active content detection (accessible from console)
window.debugActiveContent = function() {
  console.log('=== DEBUGGING ACTIVE CONTENT DETECTION ===');
  
  const { tabId } = extractDocInfo();
  console.log('Current tab ID:', tabId);
  
  // Test Method 2: Active focused editor
  const activeEditor = document.querySelector('.kix-appview-editor.kix-appview-editor-focus, .kix-appview-editor[aria-hidden="false"]');
  console.log('Active focused editor found:', !!activeEditor);
  if (activeEditor) {
    console.log('Active editor text length:', (activeEditor.innerText || '').length);
    console.log('Active editor preview:', (activeEditor.innerText || '').substring(0, 100));
  }
  
  // Test Method 3: Visible editors
  const visibleEditors = document.querySelectorAll('.kix-appview-editor:not([aria-hidden="true"])');
  console.log('Visible editors found:', visibleEditors.length);
  visibleEditors.forEach((editor, index) => {
    const style = window.getComputedStyle(editor);
    const isReallyVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    const text = editor.innerText || editor.textContent || '';
    console.log(`Editor ${index}:`, {
      visible: isReallyVisible,
      textLength: text.length,
      preview: text.substring(0, 50)
    });
  });
  
  // Test Method 5: Active element
  console.log('Document active element:', document.activeElement?.className || 'body');
  if (document.activeElement && document.activeElement !== document.body) {
    let currentElement = document.activeElement;
    console.log('Walking up from active element:');
    let depth = 0;
    while (currentElement && currentElement !== document.body && depth < 10) {
      console.log(`  ${depth}: ${currentElement.className || currentElement.tagName}`);
      if (currentElement.classList.contains('kix-appview-editor') || 
          currentElement.classList.contains('kix-page')) {
        const text = currentElement.innerText || currentElement.textContent || '';
        console.log(`    -> Found editor with ${text.length} chars`);
        break;
      }
      currentElement = currentElement.parentElement;
      depth++;
    }
  }
  
  // Test actual text extraction
  console.log('\n--- Testing getEditorText() ---');
  Promise.resolve(getEditorText()).then((result) => {
    console.log('getEditorText() result:', {
      length: result.length,
      preview: result.substring(0, 100)
    });
  });
};

// Simple diagnostic function to check basic functionality
window.diagnoseExtension = function() {
  console.log('=== EXTENSION DIAGNOSTICS ===');
  
  // Basic functionality checks
  console.log('1. Extension loaded:', typeof getEditorText === 'function');
  console.log('2. DMP available:', !!dmp);
  console.log('3. User ID:', CONFIG.USER_ID);
  console.log('4. Current URL:', window.location.href);
  console.log('5. Tab extraction:', extractDocInfo());
  
  // State checks
  const currentState = getCurrentTabState();
  console.log('6. Current tab state exists:', !!currentState);
  console.log('7. Is initialized:', currentState?.isInitialized);
  console.log('8. Batch size:', currentState?.batch?.length);
  console.log('9. Last text length:', currentState?.lastText?.length);
  
  // DOM checks
  console.log('10. Editor found:', !!document.querySelector('.kix-appview-editor'));
  console.log('11. Iframe found:', !!document.querySelector('.docs-texteventtarget-iframe'));
  console.log('12. Extractor available:', typeof window.extractGoogleDocsText === 'function');
  
  // Try a simple text extraction test
  console.log('\n--- Testing text extraction ---');
  Promise.resolve(getEditorText()).then((text) => {
    console.log('Text extraction successful:', text.length > 0);
    console.log('Text length:', text.length);
    if (text.length > 0) {
      console.log('Text preview:', text.substring(0, 100));
      
      // Test if handleTextChange would work
      if (currentState?.isInitialized) {
        console.log('Would handleTextChange detect a change:', text !== currentState.lastText);
      }
    }
  }).catch((error) => {
    console.error('Text extraction failed:', error);
  });
};

// Generate unique ID with counter to prevent duplicates
let idCounter = 0;
function generateId() {
  idCounter++;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const counter = idCounter.toString(36);
  return `${timestamp}_${random}_${counter}`;
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
  
  // Get cursor position using multiple methods
  let cursorPosition = getCursorPosition();
  
  // If direct cursor position fails, calculate from diffs
  if (cursorPosition === null || cursorPosition === 0) {
    cursorPosition = calculateCursorFromDiffs(diffs, beforeText);
  }
  
  // Update state cursor position for future fallbacks
  if (cursorPosition !== null) {
    state.cursorPosition = cursorPosition;
  }
  
  const { docId, tabId } = extractDocInfo();
  
  return {
    id: generateId(),
    doc_id: `${docId}_${tabId}`, // Include tab ID in doc identifier
    user_id: CONFIG.USER_ID,
    session_id: `${CONFIG.SESSION_ID}_${tabId}`, // Include tab ID in session
    timestamp: timestamp,
    before_text: beforeText,
    after_text: afterText,
    diff_data: diffs,
    action_type: actionType,
    cursor_position: cursorPosition,
    text_length_before: beforeText.length,
    text_length_after: afterText.length,
    keystroke_count: ++state.keystrokeCount
  };
}

// Send batch to server with debouncing
async function sendBatch() {
  if (state.batch.length === 0) return;
  
  // Debounce: don't send more than once every 2 seconds
  const now = Date.now();
  if (now - state.lastSendTime < 2000) {
    // Clear existing timeout and set new one
    if (state.sendTimeout) {
      clearTimeout(state.sendTimeout);
    }
    state.sendTimeout = setTimeout(sendBatch, 2000 - (now - state.lastSendTime));
    return;
  }
  
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
      state.lastSendTime = now;
      console.log('Extension: Batch sent successfully');
    } else {
      console.error('Extension: Server error:', response.status, response.statusText);
      // Keep the batch for retry, but don't update lastSendTime
    }
  } catch (error) {
    console.error('Extension: Network error sending batch:', error);
    // Keep the batch for retry, but don't update lastSendTime
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

// Event handlers setup - simplified and non-intrusive
function setupEventListeners() {
  console.log('Extension: Setting up event listeners for current tab');
  
  // Method 1: Listen on iframe for Google Docs input (primary method)
  const iframe = document.querySelector('.docs-texteventtarget-iframe');
  if (iframe && iframe.contentDocument) {
    console.log('Extension: Setting up iframe event listeners');
    
    const handleIframeChange = () => {
      setTimeout(async () => {
        const currentText = await getEditorText();
        const { tabId } = extractDocInfo();
        console.log(`Extension: Iframe change for tab ${tabId}, length: ${currentText.length}`);
        handleTextChange(currentText);
      }, 500); // Back to original timing
    };
    
    iframe.contentDocument.addEventListener('keyup', handleIframeChange);
    iframe.contentDocument.addEventListener('input', handleIframeChange);
    iframe.contentDocument.addEventListener('paste', handleIframeChange);
    
    // Track cursor/selection changes
    iframe.contentDocument.addEventListener('selectionchange', () => {
      const cursorPos = getCursorPosition();
      if (cursorPos !== null) {
        state.cursorPosition = cursorPos;
      }
    });
  }
  
  // Method 2: Document-level listeners as fallback (minimal interference)
  const handleDocumentChange = (event) => {
    setTimeout(async () => {
      const currentText = await getEditorText();
      const { tabId } = extractDocInfo();
      console.log(`Extension: Document change for tab ${tabId}, length: ${currentText.length}`);
      handleTextChange(currentText);
    }, 500);
  };
  
  document.addEventListener('keyup', handleDocumentChange);
  document.addEventListener('input', handleDocumentChange);
  
  // Method 3: Selection change listener (for cursor tracking)
  document.addEventListener('selectionchange', () => {
    const cursorPos = getCursorPosition();
    if (cursorPos !== null) {
      state.cursorPosition = cursorPos;
    }
  });
  
  // Page unload - send remaining batch
  window.addEventListener('beforeunload', () => {
    if (state.sendTimeout) {
      clearTimeout(state.sendTimeout);
    }
    if (state.batch.length > 0) {
      // Use synchronous send for final batch with keepalive
      fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Extension-Version': '1.0'
        },
        body: JSON.stringify({ logs: state.batch }),
        keepalive: true // Ensures request completes even on page unload
      }).catch(() => {
        // Ignore errors on page unload
      });
    }
  });
  
  console.log('Extension: Event listeners setup complete');
}

// Monitor URL changes for tab switching with multiple detection methods
function setupUrlMonitoring() {
  let currentUrl = window.location.href;
  let currentTabId = extractDocInfo().tabId;
  
  console.log('Extension: Starting URL monitoring with initial tab:', currentTabId);
  
  // Method 1: Fast polling for URL changes (more frequent)
  setInterval(() => {
    const newUrl = window.location.href;
    const { tabId: newTabId } = extractDocInfo();
    
    if (newUrl !== currentUrl || newTabId !== currentTabId) {
      console.log('Extension: Tab/URL change detected!');
      console.log('Extension: Old URL:', currentUrl, 'Tab:', currentTabId);
      console.log('Extension: New URL:', newUrl, 'Tab:', newTabId);
      
      currentUrl = newUrl;
      currentTabId = newTabId;
      
      handleTabChange(newTabId);
    }
  }, 500); // Check every 500ms for faster detection
  
  // Method 2: Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', () => {
    console.log('Extension: Popstate event detected');
    setTimeout(() => {
      const { tabId } = extractDocInfo();
      if (tabId !== currentTabId) {
        currentTabId = tabId;
        handleTabChange(tabId);
      }
    }, 100);
  });
  
  // Method 3: Listen for pushstate/replacestate (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => {
      const { tabId } = extractDocInfo();
      if (tabId !== currentTabId) {
        console.log('Extension: PushState tab change detected:', tabId);
        currentTabId = tabId;
        handleTabChange(tabId);
      }
    }, 100);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(() => {
      const { tabId } = extractDocInfo();
      if (tabId !== currentTabId) {
        console.log('Extension: ReplaceState tab change detected:', tabId);
        currentTabId = tabId;
        handleTabChange(tabId);
      }
    }, 100);
  };
  
  // Method 4: MutationObserver to watch for DOM changes that might indicate tab switches
  const observer = new MutationObserver(() => {
    // Check if URL changed (sometimes DOM updates before URL)
    setTimeout(() => {
      const { tabId } = extractDocInfo();
      if (tabId !== currentTabId) {
        console.log('Extension: MutationObserver tab change detected:', tabId);
        currentTabId = tabId;
        handleTabChange(tabId);
      }
    }, 100);
  });
  
  // Observe the document title and navigation areas for changes
  observer.observe(document.head, { childList: true, subtree: true });
  observer.observe(document.body, { 
    childList: true, 
    subtree: false, // Only direct children to avoid performance issues
    attributes: true,
    attributeFilter: ['class', 'data-tab'] // Watch for tab-related attributes
  });
}

// Handle tab change with proper cleanup and initialization
function handleTabChange(newTabId) {
  console.log(`Extension: Handling tab change to: ${newTabId}`);
  
  // Update CONFIG
  const { docId } = extractDocInfo();
  CONFIG.DOC_ID = docId;
  CONFIG.TAB_ID = newTabId;
  
  // Get or create new tab state
  const newTabState = getCurrentTabState();
  
  // Initialize the new tab if not already initialized
  if (!newTabState.isInitialized) {
    console.log(`Extension: New tab ${newTabId} needs initialization`);
    setTimeout(() => {
      initializeTab();
    }, 500); // Give Google Docs time to load the tab content
  } else {
    console.log(`Extension: Tab ${newTabId} already initialized, reactivating`);
    // Tab already initialized, just make sure event listeners are active
    setupEventListeners();
  }
}

// Initialize the logger for current tab
async function initializeTab() {
  const { docId, tabId } = extractDocInfo();
  console.log(`Extension: Initializing tab ${tabId} for document ${docId}...`);
  
  CONFIG.DOC_ID = docId;
  CONFIG.TAB_ID = tabId;
  
  // Ensure current tab state exists
  const currentState = getCurrentTabState();
  
  if (currentState.isInitialized) {
    console.log('Extension: Tab already initialized');
    return;
  }
  
  await initializeUserId();
  
  // Wait for extractor to be ready
  let attempts = 0;
  const maxAttempts = 20;
  
  const checkReady = async () => {
    const currentText = await getEditorText();
    if (typeof currentText === 'string') {
      currentState.lastText = currentText;
      currentState.isInitialized = true;

      setupEventListeners();

      console.log(`Extension: Tab ${tabId} initialized successfully`);
      console.log(`Doc ID: ${CONFIG.DOC_ID}, Tab ID: ${CONFIG.TAB_ID}, User ID: ${CONFIG.USER_ID}`);
      console.log(`Initial text length: ${currentText.length}`);

      // Start periodic sending for this tab (only if not already started)
      if (!currentState.sendInterval) {
        currentState.sendInterval = setInterval(() => {
          const tabState = getCurrentTabState();
          if (tabState.batch.length > 0) {
            sendBatch();
          }
        }, CONFIG.SEND_INTERVAL);
      }

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
          console.error(`Extension: Failed to initialize tab ${tabId} - could not extract text`);
        }
      }
    }, 500);
  }
}

// Legacy initialize function that delegates to initializeTab
async function initialize() {
  console.log('Extension: Starting initialization...');
  setupUrlMonitoring();
  await initializeTab();
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