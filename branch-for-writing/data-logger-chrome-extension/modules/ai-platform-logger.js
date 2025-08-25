// AI Platform Logger module - Non-module version for Chrome extensions
window.AIPlatformLogger = {
  // Track processed messages to avoid duplicates
  processedMessages: new Set(),

  // Configuration
  CONFIG: {
    AI_MESSAGES_API_URL: 'http://localhost:3000/api/ai-platform-messages',
  },

  // Extract message data from ChatGPT article
  extractChatGPTMessage: function(article) {
    try {
      // Get message ID to avoid duplicates
      const messageElement = article.querySelector('[data-message-id]');
      const messageId = messageElement?.getAttribute('data-message-id');
      if (!messageId || this.processedMessages.has(messageId)) {
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
      
      this.processedMessages.add(messageId);
      
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
  },

  // Extract message data from Claude conversation
  extractClaudeMessage: function(messageContainer) {
    try {
      // Generate a unique message ID based on DOM position and timestamp (not content)
      const messageId = 'claude_' + 
        (messageContainer.getAttribute('data-testid') || 
         messageContainer.className || 
         messageContainer.parentElement?.className || 
         'unknown') + '_' + 
        Array.from(messageContainer.parentElement?.children || []).indexOf(messageContainer) + '_' + 
        Date.now();
      
      if (this.processedMessages.has(messageId)) {
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
      
      this.processedMessages.add(messageId);
      
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
  },

  // Extract message data from Gemini conversation
  extractGeminiMessage: function(messageContainer) {
    try {
      // Generate a unique message ID based on DOM position and timestamp (not content)
      const messageId = 'gemini_' + 
        (messageContainer.getAttribute('data-testid') || 
         messageContainer.tagName.toLowerCase() || 
         messageContainer.className || 
         'unknown') + '_' + 
        Array.from(messageContainer.parentElement?.children || []).indexOf(messageContainer) + '_' + 
        Date.now();
      
      if (this.processedMessages.has(messageId)) {
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
      
      this.processedMessages.add(messageId);
      
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
  },

  // Send AI platform message to database
  sendAIPlatformMessage: async function(messageData, currentPlatform, userId) {
    if (!userId) {
      console.error('AI Platform: User ID not initialized, cannot send message');
      return;
    }
    
    try {
      // Extract conversation ID from URL or generate one
      const conversationId = window.PlatformDetector.extractConversationId();
      
      // Determine platform from current URL
      const platform = currentPlatform === window.PlatformDetector.PLATFORM.CHATGPT ? 'chatgpt' :
                      currentPlatform === window.PlatformDetector.PLATFORM.CLAUDE ? 'claude' :
                      currentPlatform === window.PlatformDetector.PLATFORM.GEMINI ? 'gemini' : 'unknown';
      
      const messagePayload = {
        id: window.UserManagement.generateId(),
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
        userId: userId
      };
      
      console.log(`${platform.toUpperCase()}: Sending message to database:`, messagePayload);
      
      const response = await fetch(this.CONFIG.AI_MESSAGES_API_URL, {
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
  },

  // Check if conversation already exists in database
  checkConversationExists: async function(userId, currentPlatform) {
    try {
      const conversationId = window.PlatformDetector.extractConversationId();
      const platform = currentPlatform === window.PlatformDetector.PLATFORM.CHATGPT ? 'chatgpt' :
                      currentPlatform === window.PlatformDetector.PLATFORM.CLAUDE ? 'claude' :
                      currentPlatform === window.PlatformDetector.PLATFORM.GEMINI ? 'gemini' : 'unknown';
      
      const response = await fetch(
        `${this.CONFIG.AI_MESSAGES_API_URL}?userId=${userId}&platform=${platform}&conversationId=${conversationId}&limit=1`,
        {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'X-Extension-Version': '1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.count > 0;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking conversation existence:', error);
      return false;
    }
  },

  // Monitor for new AI platform messages
  initializeAIPlatformMonitoring: function(currentPlatform, userId) {
    const platformName = currentPlatform.toUpperCase();
    console.log(`${platformName}: Initializing conversation monitoring...`);
    console.log(`${platformName}: DOM readyState:`, document.readyState);
    console.log(`${platformName}: Body element:`, !!document.body);
    
    // Process existing messages based on platform
    let existingMessages = [];
    let messageExtractor = null;
    
    switch (currentPlatform) {
      case window.PlatformDetector.PLATFORM.CHATGPT:
        existingMessages = document.querySelectorAll('article[data-testid*="conversation-turn"]');
        messageExtractor = this.extractChatGPTMessage.bind(this);
        break;
      case window.PlatformDetector.PLATFORM.CLAUDE:
        existingMessages = document.querySelectorAll('.conversation-container, [data-test-render-count]');
        messageExtractor = this.extractClaudeMessage.bind(this);
        break;
      case window.PlatformDetector.PLATFORM.GEMINI:
        existingMessages = document.querySelectorAll('.conversation-container, user-query, model-response');
        messageExtractor = this.extractGeminiMessage.bind(this);
        break;
    }
    
    console.log(`${platformName}: Found ${existingMessages.length} existing message containers`);
    
    existingMessages.forEach(container => {
      const messageData = messageExtractor(container);
      if (messageData) {
        console.log(`${platformName}: Existing message -`, messageData);
        // Send existing messages to database
        this.sendAIPlatformMessage(messageData, currentPlatform, userId);
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
              case window.PlatformDetector.PLATFORM.CHATGPT:
                if (node.matches && node.matches('article[data-testid*="conversation-turn"]')) {
                  newContainers = [node];
                } else if (node.querySelectorAll) {
                  newContainers = node.querySelectorAll('article[data-testid*="conversation-turn"]');
                }
                break;
              case window.PlatformDetector.PLATFORM.CLAUDE:
                if (node.matches && (node.matches('.conversation-container') || node.matches('[data-test-render-count]'))) {
                  newContainers = [node];
                } else if (node.querySelectorAll) {
                  newContainers = node.querySelectorAll('.conversation-container, [data-test-render-count]');
                }
                break;
              case window.PlatformDetector.PLATFORM.GEMINI:
                if (node.matches && (node.matches('.conversation-container') || node.matches('user-query') || node.matches('model-response'))) {
                  newContainers = [node];
                } else if (node.querySelectorAll) {
                  newContainers = node.querySelectorAll('.conversation-container, user-query, model-response');
                }
                break;
            }
            
            newContainers.forEach(container => {
              // Monitor AI response completion for streaming messages
              this.monitorMessageCompletion(container, messageExtractor, currentPlatform, userId, platformName);
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
  },

  // Monitor message completion for streaming AI responses
  monitorMessageCompletion: function(container, messageExtractor, currentPlatform, userId, platformName) {
    let lastContent = '';
    let stableCount = 0;
    let extractedMessageId = null;
    
    // Check immediately for user messages (which don't stream)
    setTimeout(() => {
      const initialData = messageExtractor(container);
      
      if (initialData && initialData.sender === 'user') {
        console.log(`${platformName}: User message captured -`, { 
          length: initialData.text.length, 
          preview: initialData.text.substring(0, 50) + '...' 
        });
        this.sendAIPlatformMessage(initialData, currentPlatform, userId);
        return;
      }
      
      if (initialData && initialData.sender === 'ai') {
        console.log(`${platformName}: AI message detected, monitoring completion...`);
      }
    }, 100);
    
    // For AI messages, monitor content changes until stable
    const checkCompletion = () => {
      const messageData = messageExtractor(container);
      
      if (!messageData || messageData.sender !== 'ai') {
        return;
      }
      
      const currentContent = messageData.text;
      
      // Skip if we already processed this message
      if (extractedMessageId && extractedMessageId === messageData.messageId) {
        return;
      }
      
      // Check if content has stabilized
      if (currentContent === lastContent && currentContent.length > 0) {
        stableCount++;
        
        // Content has been stable for 3 checks (3 seconds)
        if (stableCount >= 3) {
          console.log(`${platformName}: AI response completed -`, { 
            length: currentContent.length, 
            preview: currentContent.substring(0, 100) + '...' 
          });
          this.sendAIPlatformMessage(messageData, currentPlatform, userId);
          extractedMessageId = messageData.messageId;
          clearInterval(completionInterval);
          return;
        }
      } else {
        // Content changed, reset stability counter
        stableCount = 0;
        lastContent = currentContent;
        
        // Log partial content for debugging
        if (currentContent.length > 0) {
          console.log(`${platformName}: AI response in progress... ${currentContent.length} chars`);
        }
      }
    };
    
    // Check every second for completion
    const completionInterval = setInterval(checkCompletion, 1000);
    
    // Safety timeout: force extraction after 2 minutes
    setTimeout(() => {
      if (!extractedMessageId) {
        const finalData = messageExtractor(container);
        if (finalData && finalData.sender === 'ai' && finalData.text.length > 0) {
          console.log(`${platformName}: AI response timeout extraction -`, { 
            length: finalData.text.length 
          });
          this.sendAIPlatformMessage(finalData, currentPlatform, userId);
        }
      }
      clearInterval(completionInterval);
    }, 120000); // 2 minutes
  },

  // Test functions for debugging
  testAIPlatformExtraction: function(currentPlatform) {
    console.log(`=== TESTING ${currentPlatform.toUpperCase()} MESSAGE EXTRACTION ===`);
    
    let containers = [];
    let extractor = null;
    
    switch (currentPlatform) {
      case window.PlatformDetector.PLATFORM.CHATGPT:
        containers = document.querySelectorAll('article[data-testid*="conversation-turn"]');
        extractor = this.extractChatGPTMessage.bind(this);
        break;
      case window.PlatformDetector.PLATFORM.CLAUDE:
        containers = document.querySelectorAll('.conversation-container, [data-test-render-count]');
        extractor = this.extractClaudeMessage.bind(this);
        break;
      case window.PlatformDetector.PLATFORM.GEMINI:
        containers = document.querySelectorAll('.conversation-container, user-query, model-response');
        extractor = this.extractGeminiMessage.bind(this);
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
  },

  testAIMessageSending: function(currentPlatform, userId) {
    console.log('=== TESTING AI MESSAGE SENDING ===');
    
    // Test with a sample message
    const testMessage = {
      messageId: 'test_' + Date.now(),
      sender: 'user',
      text: 'This is a test message from the console',
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending test message:', testMessage);
    
    this.sendAIPlatformMessage(testMessage, currentPlatform, userId).then(() => {
      console.log('✅ Test message sent successfully');
    }).catch((error) => {
      console.error('❌ Test message failed:', error);
    });
  },

  // Debug function to monitor current AI responses
  debugAIResponseMonitoring: function(currentPlatform) {
    console.log('=== DEBUGGING AI RESPONSE MONITORING ===');
    
    const platformName = currentPlatform.toUpperCase();
    let containers = [];
    
    switch (currentPlatform) {
      case window.PlatformDetector.PLATFORM.CHATGPT:
        containers = document.querySelectorAll('article[data-testid*="conversation-turn"]');
        break;
      case window.PlatformDetector.PLATFORM.CLAUDE:
        containers = document.querySelectorAll('.conversation-container, [data-test-render-count]');
        break;
      case window.PlatformDetector.PLATFORM.GEMINI:
        containers = document.querySelectorAll('.conversation-container, user-query, model-response');
        break;
    }
    
    console.log(`Found ${containers.length} message containers for ${platformName}`);
    
    containers.forEach((container, index) => {
      const isAI = container.querySelector('.markdown, .model-response, [data-message-author-role="assistant"]');
      const isUser = container.querySelector('[data-message-author-role="user"], .user-query');
      const text = container.textContent?.trim() || '';
      
      console.log(`Container ${index + 1}:`, {
        type: isAI ? 'AI' : isUser ? 'User' : 'Unknown',
        textLength: text.length,
        preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        isComplete: !container.querySelector('.loading, .typing, .cursor') // Basic completion check
      });
    });
    
    console.log('\n📝 To monitor new responses, look for these log messages:');
    console.log(`• "${platformName}: AI response in progress..." (shows streaming)`);
    console.log(`• "${platformName}: AI response completed" (shows final capture)`);
  },

  // Test backend connectivity
  testBackendConnectivity: async function() {
    console.log('=== TESTING BACKEND CONNECTIVITY ===');
    console.log('Testing URL:', this.CONFIG.AI_MESSAGES_API_URL);
    
    try {
      // Test OPTIONS request (CORS preflight)
      const optionsResponse = await fetch(this.CONFIG.AI_MESSAGES_API_URL, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Version': '1.0'
        }
      });
      
      console.log('✅ OPTIONS request successful:', optionsResponse.status);
      
      // Test a simple GET request
      const testUserId = 'test_user_' + Date.now();
      const getResponse = await fetch(
        `${this.CONFIG.AI_MESSAGES_API_URL}?userId=${testUserId}&limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Extension-Version': '1.0'
          }
        }
      );
      
      if (getResponse.ok) {
        const data = await getResponse.json();
        console.log('✅ GET request successful:', data);
        return true;
      } else {
        console.error('❌ GET request failed:', getResponse.status, getResponse.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Backend connectivity test failed:', error);
      console.log('\n🔧 Make sure:');
      console.log('1. Your backend is running: pnpm run dev');
      console.log('2. Backend URL is correct:', this.CONFIG.AI_MESSAGES_API_URL);
      console.log('3. CORS is properly configured');
      return false;
    }
  }
};
