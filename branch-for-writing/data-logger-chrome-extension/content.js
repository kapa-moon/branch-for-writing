console.log('Keystroke Logger: Content script loaded');
console.log('URL:', window.location.href);
console.log('Hostname:', window.location.hostname);

// Platform detection (do this first before initializing anything)
const PLATFORM = {
  GOOGLE_DOCS: 'google_docs',
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  UNKNOWN: 'unknown'
};

function detectPlatform() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  if (hostname.includes('docs.google.com') && pathname.includes('/document/')) {
    return PLATFORM.GOOGLE_DOCS;
  } else if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    return PLATFORM.CHATGPT;
  } else if (hostname.includes('claude.ai')) {
    return PLATFORM.CLAUDE;
  } else if (hostname.includes('gemini.google.com')) {
    return PLATFORM.GEMINI;
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
  AI_MESSAGES_API_URL: 'http://localhost:3000/api/ai-platform-messages', // ✅ New API URL for AI messages
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

// Track processed messages to avoid duplicates (persists across page loads)
const processedMessages = new Set();

// Load previously processed messages from storage
async function loadProcessedMessages() {
  try {
    const conversationId = extractConversationId();
    const storageKey = `processed_messages_${conversationId}`;
    const result = await chrome.storage.local.get([storageKey]);
    const storedMessages = result[storageKey] || [];
    
    // Add all stored message IDs to the Set
    storedMessages.forEach(msgId => processedMessages.add(msgId));
    console.log(`${currentPlatform.toUpperCase()}: Loaded ${storedMessages.length} previously processed messages`);
  } catch (error) {
    console.error('Error loading processed messages:', error);
  }
}

// Save a processed message ID to storage
async function saveProcessedMessage(messageId) {
  try {
    const conversationId = extractConversationId();
    const storageKey = `processed_messages_${conversationId}`;
    const result = await chrome.storage.local.get([storageKey]);
    let storedMessages = result[storageKey] || [];
    
    // Add new message ID if not already stored
    if (!storedMessages.includes(messageId)) {
      storedMessages.push(messageId);
      
      // Keep only the last 1000 messages to avoid storage bloat
      if (storedMessages.length > 1000) {
        storedMessages = storedMessages.slice(-1000);
      }
      
      await chrome.storage.local.set({ [storageKey]: storedMessages });
    }
  } catch (error) {
    console.error('Error saving processed message:', error);
  }
}

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
    // Save to persistent storage
    saveProcessedMessage(messageId);
    
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

// Extract message data from Claude conversation
function extractClaudeMessage(messageContainer) {
  try {
    // Generate a unique message ID based on content and position
    const content = messageContainer.textContent?.trim() || '';
    const messageId = 'claude_' + btoa(content.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '') + '_' + Date.now();
    
    if (processedMessages.has(messageId)) {
      return null;
    }
    
    // Determine sender based on DOM structure
    let sender = 'unknown';
    
    // Check for user message indicators
    const userMessage = messageContainer.querySelector('[data-testid="user-message"]');
    const userBubble = messageContainer.querySelector('.user-query-bubble-with-background');
    
    if (userMessage || userBubble) {
      sender = 'user';
    } else {
      // Check for AI message indicators
      const aiMessage = messageContainer.querySelector('.font-claude-message');
      const modelResponse = messageContainer.querySelector('model-response');
      
      if (aiMessage || modelResponse) {
        sender = 'ai';
      }
    }
    
    // Extract text content
    let text = '';
    
    // For user messages
    if (sender === 'user') {
      const userText = messageContainer.querySelector('.query-text, [data-testid="user-message"] p');
      if (userText) {
        text = userText.textContent?.trim() || '';
      }
    }
    
    // For AI messages
    if (sender === 'ai') {
      const aiText = messageContainer.querySelector('.markdown p, .model-response-text p');
      if (aiText) {
        text = aiText.textContent?.trim() || '';
      }
    }
    
    // Fallback: get any text content
    if (!text) {
      text = content;
      // Clean up common UI text
      text = text.replace(/Edit.*?$/g, '').replace(/Copy.*?$/g, '').replace(/Retry.*?$/g, '').trim();
    }
    
    if (!text) {
      return null;
    }
    
    const timestamp = new Date().toISOString();
    
    processedMessages.add(messageId);
    // Save to persistent storage
    saveProcessedMessage(messageId);
    
    return {
      messageId,
      sender,
      timestamp,
      text
    };
  } catch (error) {
    console.error('Claude: Error extracting message:', error);
    return null;
  }
}

// Extract message data from Gemini conversation
function extractGeminiMessage(messageContainer) {
  try {
    // Generate a unique message ID based on content and position
    const content = messageContainer.textContent?.trim() || '';
    const messageId = 'gemini_' + btoa(content.substring(0, 50)).replace(/[^a-zA-Z0-9]/g, '') + '_' + Date.now();
    
    if (processedMessages.has(messageId)) {
      return null;
    }
    
    // Determine sender based on DOM structure
    let sender = 'unknown';
    
    // Check for user message indicators
    const userQuery = messageContainer.querySelector('user-query');
    const userQueryContent = messageContainer.querySelector('.user-query-container');
    
    if (userQuery || userQueryContent) {
      sender = 'user';
    } else {
      // Check for AI message indicators
      const modelResponse = messageContainer.querySelector('model-response');
      const responseContent = messageContainer.querySelector('.response-content');
      
      if (modelResponse || responseContent) {
        sender = 'ai';
      }
    }
    
    // Extract text content
    let text = '';
    
    // For user messages
    if (sender === 'user') {
      const userText = messageContainer.querySelector('.query-text, .user-query-bubble-with-background p');
      if (userText) {
        text = userText.textContent?.trim() || '';
      }
    }
    
    // For AI messages
    if (sender === 'ai') {
      const aiText = messageContainer.querySelector('.markdown p, .model-response-text p');
      if (aiText) {
        text = aiText.textContent?.trim() || '';
      }
    }
    
    // Fallback: get any text content
    if (!text) {
      text = content;
      // Clean up common UI text
      text = text.replace(/Edit.*?$/g, '').replace(/Copy.*?$/g, '').replace(/Share.*?$/g, '').trim();
    }
    
    if (!text) {
      return null;
    }
    
    const timestamp = new Date().toISOString();
    
    processedMessages.add(messageId);
    // Save to persistent storage
    saveProcessedMessage(messageId);
    
    return {
      messageId,
      sender,
      timestamp,
      text
    };
  } catch (error) {
    console.error('Gemini: Error extracting message:', error);
    return null;
  }
}

// Send AI platform message to database
async function sendAIPlatformMessage(messageData) {
  if (!CONFIG.USER_ID) {
    console.error('AI Platform: User ID not initialized, cannot send message');
    return;
  }
  
  try {
    // Extract conversation ID from URL or generate one
    const conversationId = extractConversationId();
    
    // Determine platform from current URL
    const platform = currentPlatform === PLATFORM.CHATGPT ? 'chatgpt' :
                    currentPlatform === PLATFORM.CLAUDE ? 'claude' :
                    currentPlatform === PLATFORM.GEMINI ? 'gemini' : 'unknown';
    
    const messagePayload = {
      id: generateId(),
      platform: platform,
      conversationId: conversationId,
      messageId: messageData.messageId,
      sender: messageData.sender,
      content: messageData.text,
      timestamp: messageData.timestamp,
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        platform: platform
      },
      userId: CONFIG.USER_ID
    };
    
    console.log(`${platform.toUpperCase()}: Sending message to database:`, messagePayload);
    
    const response = await fetch(CONFIG.AI_MESSAGES_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Extension-Version': '1.0'
      },
      body: JSON.stringify(messagePayload)
    });
    
    if (response.ok) {
      console.log(`${platform.toUpperCase()}: Message sent successfully`);
    } else {
      console.error(`${platform.toUpperCase()}: Failed to send message:`, response.status, response.statusText);
    }
  } catch (error) {
    console.error('AI Platform: Error sending message:', error);
  }
}

// Extract conversation ID from AI platform URLs
function extractConversationId() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  // ChatGPT URLs: https://chatgpt.com/c/conversation-id
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    const pathMatch = pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  
  // Claude URLs: https://claude.ai/chat/conversation-id
  if (hostname.includes('claude.ai')) {
    const pathMatch = pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  
  // Gemini URLs: https://gemini.google.com/app/conversation-id
  if (hostname.includes('gemini.google.com')) {
    const pathMatch = pathname.match(/\/app\/([a-zA-Z0-9-]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  
  // Fallback: use URL hash or generate from current URL
  if (window.location.hash) {
    return 'hash_' + window.location.hash.substring(1);
  }
  
  // Final fallback: generate from current URL
  return 'url_' + btoa(window.location.href).substring(0, 20);
}

// Check if the current conversation is already tracked
async function isConversationTracked() {
  try {
    const conversationId = extractConversationId();
    const result = await chrome.storage.local.get(['tracked_ai_conversations']);
    const trackedConversations = result.tracked_ai_conversations || [];
    
    return trackedConversations.includes(conversationId);
  } catch (error) {
    console.error('Error checking conversation tracking status:', error);
    return false;
  }
}

// Add conversation to tracked list
async function addTrackedConversation(conversationId) {
  try {
    const result = await chrome.storage.local.get(['tracked_ai_conversations']);
    let trackedConversations = result.tracked_ai_conversations || [];
    
    if (!trackedConversations.includes(conversationId)) {
      trackedConversations.push(conversationId);
      await chrome.storage.local.set({ 'tracked_ai_conversations': trackedConversations });
      console.log(`${currentPlatform.toUpperCase()}: Conversation ${conversationId} added to tracking list`);
    }
  } catch (error) {
    console.error('Error adding conversation to tracking list:', error);
  }
}

// Show permission request popup for tracking
function showTrackingPermissionPopup() {
  const platformName = currentPlatform === PLATFORM.CHATGPT ? 'ChatGPT' :
                      currentPlatform === PLATFORM.CLAUDE ? 'Claude' :
                      currentPlatform === PLATFORM.GEMINI ? 'Gemini' : 'AI';
  
  const conversationId = extractConversationId();
  
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'tracking-permission-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: 'Atkinson Hyperlegible', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  
  // Create popup content
  const popup = document.createElement('div');
  popup.style.cssText = `
    background-color: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  `;
  
  popup.innerHTML = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #000;">
      Track this ${platformName} conversation?
    </h2>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #333;">
      Would you like to log this conversation for research purposes? Your messages will be stored securely for analysis.
    </p>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="tracking-deny" style="
        padding: 10px 20px;
        border: 2px solid #ccc;
        background-color: white;
        color: #666;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      ">
        No, thanks
      </button>
      <button id="tracking-allow" style="
        padding: 10px 20px;
        border: 2px solid #000;
        background-color: #000;
        color: white;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      ">
        Yes, track this conversation
      </button>
    </div>
  `;
  
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  
  // Add event listeners
  document.getElementById('tracking-allow').addEventListener('click', async () => {
    await addTrackedConversation(conversationId);
    overlay.remove();
    // Start monitoring after permission granted
    startAIPlatformMonitoring();
  });
  
  document.getElementById('tracking-deny').addEventListener('click', () => {
    overlay.remove();
    console.log(`${currentPlatform.toUpperCase()}: User declined tracking for conversation ${conversationId}`);
  });
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Start monitoring AI platform messages
function startAIPlatformMonitoring() {
  const platformName = currentPlatform.toUpperCase();
  console.log(`${platformName}: Starting conversation monitoring...`);
  
  // Process existing messages based on platform
  let existingMessages = [];
  let messageExtractor = null;
  
  switch (currentPlatform) {
    case PLATFORM.CHATGPT:
      existingMessages = document.querySelectorAll('article[data-testid*="conversation-turn"]');
      messageExtractor = extractChatGPTMessage;
      break;
    case PLATFORM.CLAUDE:
      existingMessages = document.querySelectorAll('.conversation-container, [data-test-render-count]');
      messageExtractor = extractClaudeMessage;
      break;
    case PLATFORM.GEMINI:
      existingMessages = document.querySelectorAll('.conversation-container, user-query, model-response');
      messageExtractor = extractGeminiMessage;
      break;
  }
  
  console.log(`${platformName}: Found ${existingMessages.length} existing message containers`);
  
  existingMessages.forEach(container => {
    const messageData = messageExtractor(container);
    if (messageData) {
      console.log(`${platformName}: Existing message -`, messageData);
      // Send existing messages to database
      sendAIPlatformMessage(messageData);
    }
  });
  
  // Set up MutationObserver to watch for new messages
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check for new message containers based on platform
          let newContainers = [];
          
          switch (currentPlatform) {
            case PLATFORM.CHATGPT:
              if (node.matches && node.matches('article[data-testid*="conversation-turn"]')) {
                newContainers = [node];
              } else if (node.querySelectorAll) {
                newContainers = node.querySelectorAll('article[data-testid*="conversation-turn"]');
              }
              break;
            case PLATFORM.CLAUDE:
              if (node.matches && (node.matches('.conversation-container') || node.matches('[data-test-render-count]'))) {
                newContainers = [node];
              } else if (node.querySelectorAll) {
                newContainers = node.querySelectorAll('.conversation-container, [data-test-render-count]');
              }
              break;
            case PLATFORM.GEMINI:
              if (node.matches && (node.matches('.conversation-container') || node.matches('user-query') || node.matches('model-response'))) {
                newContainers = [node];
              } else if (node.querySelectorAll) {
                newContainers = node.querySelectorAll('.conversation-container, user-query, model-response');
              }
              break;
          }
          
          newContainers.forEach(container => {
            // Add a small delay to ensure the content is fully rendered
            setTimeout(() => {
              const messageData = messageExtractor(container);
              if (messageData) {
                console.log(`${platformName}: New message -`, messageData);
                // Send new messages to database
                sendAIPlatformMessage(messageData);
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
  
  console.log(`${platformName}: Monitoring initialized successfully`);
}

// Monitor for new AI platform messages
async function initializeAIPlatformMonitoring() {
  const platformName = currentPlatform.toUpperCase();
  console.log(`${platformName}: Initializing conversation monitoring...`);
  console.log(`${platformName}: DOM readyState:`, document.readyState);
  console.log(`${platformName}: Body element:`, !!document.body);
  
  // Initialize user ID first
  await initializeUserId();
  console.log(`${platformName}: User ID initialized for monitoring`);
  
  // Load previously processed messages to avoid duplicates when revisiting conversations
  await loadProcessedMessages();
  
  // Check if conversation is already tracked
  const isTracked = await isConversationTracked();
  
  if (isTracked) {
    console.log(`${platformName}: Conversation is already tracked, starting monitoring`);
    startAIPlatformMonitoring();
  } else {
    console.log(`${platformName}: Conversation not tracked, showing permission popup`);
    // Wait a bit for the page to fully load before showing popup
    setTimeout(() => {
      showTrackingPermissionPopup();
    }, 2000);
  }
}

// Manual test function for AI platform message extraction (accessible from console)
window.testAIPlatformExtraction = function() {
  console.log(`=== TESTING ${currentPlatform.toUpperCase()} MESSAGE EXTRACTION ===`);
  
  let containers = [];
  let extractor = null;
  
  switch (currentPlatform) {
    case PLATFORM.CHATGPT:
      containers = document.querySelectorAll('article[data-testid*="conversation-turn"]');
      extractor = extractChatGPTMessage;
      break;
    case PLATFORM.CLAUDE:
      containers = document.querySelectorAll('.conversation-container, [data-test-render-count]');
      extractor = extractClaudeMessage;
      break;
    case PLATFORM.GEMINI:
      containers = document.querySelectorAll('.conversation-container, user-query, model-response');
      extractor = extractGeminiMessage;
      break;
    default:
      console.log('❌ Unknown platform for testing');
      return;
  }
  
  console.log(`Found ${containers.length} message containers`);
  
  containers.forEach((container, index) => {
    console.log(`\n--- Container ${index + 1} ---`);
    const messageData = extractor(container);
    if (messageData) {
      console.log('✅ Extracted message:', messageData);
    } else {
      console.log('❌ Failed to extract message from this container');
      console.log('Container HTML preview:', container.outerHTML.substring(0, 200) + '...');
    }
  });
  
  console.log('\n=== TEST COMPLETE ===');
};

// Legacy function for backward compatibility
window.testChatGPTExtraction = function() {
  if (currentPlatform === PLATFORM.CHATGPT) {
    window.testAIPlatformExtraction();
  } else {
    console.log('❌ This function is only for ChatGPT. Use testAIPlatformExtraction() instead.');
  }
};

// Manual test function for AI message sending (accessible from console)
window.testAIMessageSending = function() {
  console.log('=== TESTING AI MESSAGE SENDING ===');
  
  // Test with a sample message
  const testMessage = {
    messageId: 'test_' + Date.now(),
    sender: 'user',
    text: 'This is a test message from the console',
    timestamp: new Date().toISOString()
  };
  
  console.log('Sending test message:', testMessage);
  
  sendAIPlatformMessage(testMessage).then(() => {
    console.log('✅ Test message sent successfully');
  }).catch((error) => {
    console.error('❌ Test message failed:', error);
  });
};

// User ID management functions (accessible from console)
window.getUserInfo = function() {
  console.log('=== USER ID INFORMATION ===');
  console.log('Current User ID:', CONFIG.USER_ID);
  console.log('Platform:', currentPlatform);
  console.log('Current URL:', window.location.href);
  
  // Get stored data
  chrome.storage.local.get(['keystroke_logger_user_id', 'machine_id'], (result) => {
    console.log('Stored User ID:', result.keystroke_logger_user_id);
    console.log('Machine ID:', result.machine_id);
  });
};

window.resetUserID = function() {
  console.log('=== RESETTING USER ID ===');
  chrome.storage.local.remove(['keystroke_logger_user_id', 'machine_id'], () => {
    console.log('User ID and Machine ID cleared from storage');
    console.log('Please refresh the page to generate a new User ID');
  });
};

window.exportUserData = function() {
  console.log('=== EXPORTING USER DATA ===');
  const data = {
    userId: CONFIG.USER_ID,
    platform: currentPlatform,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    extensionVersion: '0.1'
  };
  
  // Create download link
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `user-data-${CONFIG.USER_ID}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('User data exported:', data);
};

// Initialize user ID from storage or generate new one
async function initializeUserId() {
  try {
    // Try to get existing user ID from storage
    const result = await chrome.storage.local.get(['keystroke_logger_user_id']);
    
    if (result.keystroke_logger_user_id) {
      CONFIG.USER_ID = result.keystroke_logger_user_id;
      console.log('Extension: Using existing User ID:', CONFIG.USER_ID);
    } else {
      // Generate a new persistent user ID
      // Use a combination of machine-specific info and timestamp for uniqueness
      const machineId = await generateMachineId();
      CONFIG.USER_ID = `user_${machineId}_${Date.now()}`;
      
      // Store it permanently
      await chrome.storage.local.set({keystroke_logger_user_id: CONFIG.USER_ID});
      console.log('Extension: Generated new persistent User ID:', CONFIG.USER_ID);
    }
    
    return CONFIG.USER_ID;
  } catch (error) {
    console.error('Error initializing user ID:', error);
    // Fallback: generate a temporary ID
    CONFIG.USER_ID = 'user_temp_' + generateId();
    return CONFIG.USER_ID;
  }
}

// Generate a machine-specific ID that persists across sessions
async function generateMachineId() {
  try {
    // Try to get existing machine ID
    const result = await chrome.storage.local.get(['machine_id']);
    
    if (result.machine_id) {
      return result.machine_id;
    }
    
    // Generate a new machine ID based on available system info
    const systemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth
    };
    
    // Create a hash-like string from system info
    const machineString = JSON.stringify(systemInfo);
    const machineId = btoa(machineString).substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
    
    // Store it permanently
    await chrome.storage.local.set({machine_id: machineId});
    
    console.log('Extension: Generated new machine ID:', machineId);
    return machineId;
  } catch (error) {
    console.error('Error generating machine ID:', error);
    // Fallback: use timestamp-based ID
    return 'machine_' + Date.now().toString(36);
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

// Check if the current document should be tracked
async function shouldTrackCurrentDocument() {
  if (currentPlatform !== PLATFORM.GOOGLE_DOCS) {
    // For non-Google Docs platforms, always track
    return true;
  }
  
  try {
    // Get the tracked document IDs from storage
    const result = await chrome.storage.local.get(['tracked_doc_ids']);
    const trackedDocIds = result.tracked_doc_ids || [];
    
    // If no documents are in the tracking list, don't track anything
    if (trackedDocIds.length === 0) {
      console.log('Extension: No documents in tracking list, skipping tracking');
      return false;
    }
    
    // Extract current document ID
    const { docId } = extractDocInfo();
    
    // Check if current document is in the tracked documents list
    if (trackedDocIds.includes(docId)) {
      console.log('Extension: Current document is in tracking list:', docId);
      return true;
    } else {
      console.log('Extension: Current document is not in tracking list');
      console.log('Extension: Current doc:', docId);
      console.log('Extension: Tracked docs:', trackedDocIds);
      console.log('Extension: Skipping tracking for this document');
      return false;
    }
  } catch (error) {
    console.error('Extension: Error checking tracked documents:', error);
    // On error, default to not tracking
    return false;
  }
}

// Platform-specific initialization
async function initializePlatform() {
  console.log('Initializing for platform:', currentPlatform);
  console.log('Current hostname:', window.location.hostname);
  console.log('Platform constants:', PLATFORM);
  
  // Check if we should track this document
  const shouldTrack = await shouldTrackCurrentDocument();
  
  if (!shouldTrack) {
    console.log('Extension: Tracking disabled for this document');
    return;
  }
  
  switch (currentPlatform) {
    case PLATFORM.GOOGLE_DOCS:
      console.log('Initializing Google Docs keystroke logging...');
      installExtractor();
      break;
      
    case PLATFORM.CHATGPT:
    case PLATFORM.CLAUDE:
    case PLATFORM.GEMINI:
      console.log(`Initializing ${currentPlatform} conversation monitoring...`);
      try {
        initializeAIPlatformMonitoring();
      } catch (error) {
        console.error(`Error initializing ${currentPlatform} monitoring:`, error);
      }
      break;
      
    default:
      console.log('Unknown platform, skipping initialization');
      console.log('Detected platform value:', currentPlatform);
      break;
  }
}

// Listen for storage changes (when user updates tracked documents list)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.tracked_doc_ids) {
    console.log('Extension: Tracked documents list changed, reloading page to apply changes');
    // Reload the page to reinitialize with new settings
    window.location.reload();
  }
});

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializePlatform, 1000);
  });
} else {
  setTimeout(initializePlatform, 1000);
}