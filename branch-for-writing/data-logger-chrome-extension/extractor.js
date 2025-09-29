/**
 * Google Docs Text Extractor - Runs in page context
 * This script is injected as a separate file to avoid CSP issues
 */

(function() {
  console.log('=== GOOGLE DOCS TEXT EXTRACTOR LOADED ===');
  try {
    // Sanity marker for the content script
    window.docsTextExtractorInstalled = true;
  } catch (_) {}
  
  // Store tab-aware extraction function globally
  window.extractGoogleDocsText = function(tabId = 'main') {
    try {
      console.log(`Extractor: Starting text extraction for tab: ${tabId}`);
      
      // Method 1: Advanced iframe closure extraction (WORKING METHOD!)
      const iframe = document.querySelector('.docs-texteventtarget-iframe');
      if (iframe && iframe.contentDocument) {
        const doc = iframe.contentDocument;
        const closureKey = Object.keys(doc).find(k => k.startsWith('closure_'));
        
        if (closureKey) {
          const result = dig(doc[closureKey], new Set()) || '';
          if (result.length > 0) {
            console.log(`Extractor: Text extraction successful via iframe closure for tab ${tabId}: ${result.length} chars`);
            return result;
          }
        }
      }
      
      // Method 2: Fallback to DOM selectors (filter out UI text)
      const editorArea = document.querySelector('.kix-appview-editor');
      if (editorArea) {
        const allText = (editorArea.innerText || editorArea.textContent || '').trim();
        // Try to extract just the document content by removing common UI text
        const cleanText = allText
          .replace(/Gemini created these notes\..*?double-checked\.\s*/g, '')
          .replace(/How Gemini takes notes.*?$/g, '')
          .replace(/Spelling.*?menu\./g, '')
          .replace(/Why am I not seeing a suggestion\?/g, '')
          .replace(/Drag image to reposition/g, '')
          .trim();
        
        if (cleanText.length > 0) {
          console.log(`Extractor: Text extraction (DOM fallback) for tab ${tabId}: ${cleanText.length} chars`);
          return cleanText;
        }
      }
      
      console.log(`Extractor: No document text found for tab ${tabId}`);
      return '';
    } catch (error) {
      console.log(`Extractor: Text extraction error for tab ${tabId}:`, error);
      return '';
    }
  };

  // The working dig function to extract text from Google's closure objects
  function dig(src, seen) {
    if (!src || seen.has(src)) return '';
    seen.add(src);
    
    const values = Array.isArray(src) ? src : Object.values(src);
    
    for (const v of values) {
      try {
        if (typeof v === 'string' && v.length > 1 && v[0] === '\x03' && v.endsWith('\n')) {
          return v.substring(1, v.length - 1); // Remove \x03 and \n
        } else if (typeof v === 'object' && v !== null) {
          const result = dig(v, seen);
          if (result) return result;
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }
  
  // Listen for extraction requests from content script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'EXTRACT_DOCS_TEXT') {
      const tabId = event.data.tabId || 'main';
      const text = window.extractGoogleDocsText(tabId);
      window.postMessage({
        type: 'DOCS_TEXT_RESULT',
        requestId: event.data.requestId,
        text: text,
        tabId: tabId
      }, '*');
    }
  });
  
  // Mark as installed
  window.docsTextExtractorInstalled = true;
  console.log('=== TEXT EXTRACTOR READY ===');
})();