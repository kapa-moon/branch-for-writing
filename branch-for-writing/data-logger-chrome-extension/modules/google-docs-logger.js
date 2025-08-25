// Google Docs Logger module - Non-module version for Chrome extensions
window.GoogleDocsLogger = {
  // Configuration
  CONFIG: {
    API_URL: 'http://localhost:3000/api/keystroke-logs',
    BATCH_SIZE: 10,
    SEND_INTERVAL: 10000,
    SESSION_ID: 'Drafting_' + Date.now(),
  },

  // Multi-tab state management - each tab has its own state
  tabStates: new Map(),

  // Get or create state for current tab
  getCurrentTabState: function() {
    const tabId = this.getDocumentTabId();
    
    if (!this.tabStates.has(tabId)) {
      this.tabStates.set(tabId, {
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
    
    return this.tabStates.get(tabId);
  },

  // Extract Google Doc ID and Tab ID from URL
  extractDocInfo: function() {
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
  },

  // Get unique document+tab identifier
  getDocumentTabId: function() {
    const { docId, tabId } = this.extractDocInfo();
    return `${docId}_${tabId}`;
  },

  // Initialize the logger for current tab
  initializeTab: async function(dmp, userId) {
    const { docId, tabId } = this.extractDocInfo();
    console.log(`Extension: Initializing tab ${tabId} for document ${docId}...`);
    
    // Ensure current tab state exists
    const currentState = this.getCurrentTabState();
    
    if (currentState.isInitialized) {
      console.log('Extension: Tab already initialized');
      return;
    }
    
    // Wait for extractor to be ready
    let attempts = 0;
    const maxAttempts = 20;
    
    const checkReady = async () => {
      const currentText = await this.getEditorText();
      if (typeof currentText === 'string') {
        currentState.lastText = currentText;
        currentState.isInitialized = true;

        this.setupEventListeners(dmp, userId);

        console.log(`Extension: Tab ${tabId} initialized successfully`);
        console.log(`Doc ID: ${docId}, Tab ID: ${tabId}, User ID: ${userId}`);
        console.log(`Initial text length: ${currentText.length}`);

        // Start periodic sending for this tab (only if not already started)
        if (!currentState.sendInterval) {
          currentState.sendInterval = setInterval(() => {
            const tabState = this.getCurrentTabState();
            if (tabState.batch.length > 0) {
              this.sendBatch();
            }
          }, this.CONFIG.SEND_INTERVAL);
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
  },

  // Get current editor text - simplified approach
  getEditorText: async function() {
    try {
      const { tabId } = this.extractDocInfo();
      console.log(`Extension: Attempting text extraction for tab ${tabId}...`);

      // Method 1: Direct iframe closure method (proven to work)
      const iframe = document.querySelector('.docs-texteventtarget-iframe');
      if (iframe && iframe.contentDocument) {
        console.log('Extension: Trying iframe closure extraction...');
        const doc = iframe.contentDocument;
        const closureKey = Object.keys(doc).find(k => k.startsWith('closure_'));
        
        if (closureKey) {
          const result = this.digText(doc[closureKey], new Set()) || '';
          if (result.length > 0) {
            console.log('Extension: Iframe closure extraction success:', result.length, 'chars');
            return result;
          }
        }
      }
      
      // Method 2: Simple DOM extraction (fallback)
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
  },

  // Dig function to extract text from Google's closure objects
  digText: function(src, seen) {
    if (!src || seen.has(src)) return '';
    seen.add(src);
    
    const values = Array.isArray(src) ? src : Object.values(src);
    
    for (const v of values) {
      try {
        if (typeof v === 'string' && v.length > 1 && v[0] === '\x03' && v.endsWith('\n')) {
          return v.substring(1, v.length - 1); // Remove \x03 and \n
        } else if (typeof v === 'object' && v !== null) {
          const result = this.digText(v, seen);
          if (result) return result;
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  },

  // Event handlers setup - simplified
  setupEventListeners: function(dmp, userId) {
    console.log('Extension: Setting up event listeners for current tab');
    
    // Method 1: Listen on iframe for Google Docs input (primary method)
    const iframe = document.querySelector('.docs-texteventtarget-iframe');
    if (iframe && iframe.contentDocument) {
      console.log('Extension: Setting up iframe event listeners');
      
      const handleIframeChange = () => {
        setTimeout(async () => {
          const currentText = await this.getEditorText();
          const { tabId } = this.extractDocInfo();
          console.log(`Extension: Iframe change for tab ${tabId}, length: ${currentText.length}`);
          this.handleTextChange(currentText, dmp, userId);
        }, 500);
      };
      
      iframe.contentDocument.addEventListener('keyup', handleIframeChange);
      iframe.contentDocument.addEventListener('input', handleIframeChange);
      iframe.contentDocument.addEventListener('paste', handleIframeChange);
    }
    
    // Method 2: Document-level listeners as fallback
    const handleDocumentChange = (event) => {
      setTimeout(async () => {
        const currentText = await this.getEditorText();
        const { tabId } = this.extractDocInfo();
        console.log(`Extension: Document change for tab ${tabId}, length: ${currentText.length}`);
        this.handleTextChange(currentText, dmp, userId);
      }, 500);
    };
    
    document.addEventListener('keyup', handleDocumentChange);
    document.addEventListener('input', handleDocumentChange);
    
    console.log('Extension: Event listeners setup complete');
  },

  // Handle text change
  handleTextChange: function(currentText, dmp, userId) {
    console.log('Extension: Text change detected');
    
    const currentState = this.getCurrentTabState();
    if (!currentState.isInitialized) return;
    
    if (currentText !== currentState.lastText) {
      const logEntry = this.createLogEntry(currentState.lastText, currentText, dmp, userId);
      if (logEntry) {
        currentState.batch.push(logEntry);
        currentState.lastText = currentText;
        
        console.log(`Extension: ${logEntry.action_type} - ${logEntry.text_length_after} chars`);
        
        if (currentState.batch.length >= this.CONFIG.BATCH_SIZE) {
          this.sendBatch();
        }
      }
    }
  },

  // Create log entry from text change
  createLogEntry: function(beforeText, afterText, dmp, userId) {
    if (!dmp) {
      console.error('diff_match_patch not available');
      return null;
    }
    
    const timestamp = new Date().toISOString();
    const diffs = dmp.diff_main(beforeText, afterText);
    dmp.diff_cleanupSemantic(diffs);
    
    const actionType = this.determineActionType(diffs, beforeText.length, afterText.length);
    
    const { docId, tabId } = this.extractDocInfo();
    
    return {
      id: window.UserManagement.generateId(),
      doc_id: `${docId}_${tabId}`,
      user_id: userId,
      session_id: `${this.CONFIG.SESSION_ID}_${tabId}`,
      timestamp: timestamp,
      before_text: beforeText,
      after_text: afterText,
      diff_data: diffs,
      action_type: actionType,
      cursor_position: null,
      text_length_before: beforeText.length,
      text_length_after: afterText.length,
      keystroke_count: 1
    };
  },

  // Determine action type based on diff results
  determineActionType: function(diffs, beforeLength, afterLength) {
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
  },

  // Send batch to server
  sendBatch: async function() {
    const currentState = this.getCurrentTabState();
    if (currentState.batch.length === 0) return;
    
    const batchToSend = [...currentState.batch];
    console.log(`Extension: Sending batch of ${batchToSend.length} entries`);
    
    try {
      const response = await fetch(this.CONFIG.API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Extension-Version': '1.0'
        },
        body: JSON.stringify({ logs: batchToSend })
      });
      
      if (response.ok) {
        currentState.batch = currentState.batch.slice(batchToSend.length);
        currentState.lastSendTime = Date.now();
        console.log('Extension: Batch sent successfully');
      } else {
        console.error('Extension: Server error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Extension: Network error sending batch:', error);
    }
  },

  // Monitor URL changes for tab switching
  setupUrlMonitoring: function() {
    let currentUrl = window.location.href;
    let currentTabId = this.extractDocInfo().tabId;
    
    console.log('Extension: Starting URL monitoring with initial tab:', currentTabId);
    
    // Fast polling for URL changes
    setInterval(() => {
      const newUrl = window.location.href;
      const { tabId: newTabId } = this.extractDocInfo();
      
      if (newUrl !== currentUrl || newTabId !== currentTabId) {
        console.log('Extension: Tab/URL change detected!');
        console.log('Extension: Old URL:', currentUrl, 'Tab:', currentTabId);
        console.log('Extension: New URL:', newUrl, 'Tab:', newTabId);
        
        currentUrl = newUrl;
        currentTabId = newTabId;
        
        this.handleTabChange(newTabId);
      }
    }, 500);
  },

  // Handle tab change
  handleTabChange: function(newTabId) {
    console.log(`Extension: Handling tab change to: ${newTabId}`);
    
    // Get or create new tab state
    const newTabState = this.getCurrentTabState();
    
    // Initialize the new tab if not already initialized
    if (!newTabState.isInitialized) {
      console.log(`Extension: New tab ${newTabId} needs initialization`);
      setTimeout(() => {
        this.initializeTab();
      }, 500);
    } else {
      console.log(`Extension: Tab ${newTabId} already initialized, reactivating`);
      this.setupEventListeners();
    }
  },

  // Test functions for debugging
  testGoogleDocsTextExtraction: function() {
    console.log('=== TESTING GOOGLE DOCS TEXT EXTRACTION ===');
    console.log('Extension loaded:', typeof this.getEditorText !== 'undefined');
    console.log('Current tab ID:', this.extractDocInfo().tabId);
    
    if (typeof this.getEditorText !== 'undefined') {
      Promise.resolve(this.getEditorText()).then((result) => {
        console.log('Extension extraction result length:', result.length);
        console.log('Result preview:', result.substring(0, 100));
        
        // Also test state and initialization
        console.log('Current tab state:', this.getCurrentTabState());
      });
    } else {
      console.log('Extension getEditorText function not available');
    }
  }
};
