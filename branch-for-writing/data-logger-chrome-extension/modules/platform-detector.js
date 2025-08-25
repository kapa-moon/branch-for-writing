// Platform detection module - Non-module version for Chrome extensions
window.PlatformDetector = {
  PLATFORM: {
    GOOGLE_DOCS: 'google_docs',
    CHATGPT: 'chatgpt',
    CLAUDE: 'claude',
    GEMINI: 'gemini',
    UNKNOWN: 'unknown'
  },

  detectPlatform: function() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    if (hostname.includes('docs.google.com') && pathname.includes('/document/')) {
      return this.PLATFORM.GOOGLE_DOCS;
    } else if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
      return this.PLATFORM.CHATGPT;
    } else if (hostname.includes('claude.ai')) {
      return this.PLATFORM.CLAUDE;
    } else if (hostname.includes('gemini.google.com')) {
      return this.PLATFORM.GEMINI;
    }
    
    return this.PLATFORM.UNKNOWN;
  },

  extractConversationId: function() {
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
};
