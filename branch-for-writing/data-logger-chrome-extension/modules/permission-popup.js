// Permission Popup module - Non-module version for Chrome extensions
window.PermissionPopup = {
  // Create and show permission popup
  createPermissionPopup: function(currentPlatform, userId, onPermissionGranted) {
    // Check if popup already exists
    if (document.getElementById('ai-logger-permission-popup')) {
      return;
    }

    // Check if conversation already exists in database
    window.AIPlatformLogger.checkConversationExists(userId, currentPlatform).then((exists) => {
      if (exists) {
        console.log('Conversation already exists in database, no permission needed');
        onPermissionGranted();
        return;
      }

      // Create popup container
      const popup = document.createElement('div');
      popup.id = 'ai-logger-permission-popup';
      popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      // Create popup content
      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 32px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        text-align: center;
      `;

      // Platform-specific content
      const platformNames = {
        'chatgpt': 'ChatGPT',
        'claude': 'Claude',
        'gemini': 'Gemini'
      };

      const platformName = platformNames[currentPlatform] || currentPlatform;
      const conversationId = window.PlatformDetector.extractConversationId();

      content.innerHTML = `
        <div style="margin-bottom: 24px;">
          <div style="width: 64px; height: 64px; background: #3b82f6; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h2 style="margin: 0 0 8px; color: #1f2937; font-size: 24px; font-weight: 600;">
            Enable AI Conversation Logging
          </h2>
          <p style="margin: 0; color: #6b7280; font-size: 16px; line-height: 1.5;">
            The Data Logger extension would like to log your conversation with ${platformName} for research purposes.
          </p>
        </div>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: left;">
          <h3 style="margin: 0 0 8px; color: #374151; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
            What will be logged:
          </h3>
          <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
            <li>Message content (your questions and AI responses)</li>
            <li>Timestamps of when messages were sent</li>
            <li>Conversation identifier (${conversationId.substring(0, 8)}...)</li>
            <li>Platform information (${platformName})</li>
          </ul>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 32px;">
          <button id="ai-logger-deny-btn" style="
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
            Deny
          </button>
          <button id="ai-logger-allow-btn" style="
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
            Allow Logging
          </button>
        </div>

        <div style="margin-top: 16px;">
          <label style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; font-size: 14px; cursor: pointer;">
            <input type="checkbox" id="ai-logger-remember-choice" style="margin: 0;" checked>
            Remember my choice for this conversation
          </label>
        </div>
      `;

      popup.appendChild(content);
      document.body.appendChild(popup);

      // Add event listeners
      const allowBtn = document.getElementById('ai-logger-allow-btn');
      const denyBtn = document.getElementById('ai-logger-deny-btn');
      const rememberCheckbox = document.getElementById('ai-logger-remember-choice');

      allowBtn.addEventListener('click', () => {
        const remember = rememberCheckbox.checked;
        if (remember) {
          // Store permission for this conversation
          chrome.storage.local.set({
            [`ai_logger_permission_${currentPlatform}_${conversationId}`]: true
          });
        }
        
        this.removePermissionPopup();
        onPermissionGranted();
      });

      denyBtn.addEventListener('click', () => {
        const remember = rememberCheckbox.checked;
        if (remember) {
          // Store permission denial for this conversation
          chrome.storage.local.set({
            [`ai_logger_permission_${currentPlatform}_${conversationId}`]: false
          });
        }
        
        this.removePermissionPopup();
        console.log('AI logging permission denied by user');
      });

      // Close popup when clicking outside
      popup.addEventListener('click', (e) => {
        if (e.target === popup) {
          this.removePermissionPopup();
        }
      });

      // Close popup with Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.removePermissionPopup();
        }
      });
    });
  },

  // Remove permission popup
  removePermissionPopup: function() {
    const popup = document.getElementById('ai-logger-permission-popup');
    if (popup) {
      popup.remove();
    }
  },

  // Check if user has already given permission for this conversation
  checkExistingPermission: async function(currentPlatform) {
    try {
      const conversationId = window.PlatformDetector.extractConversationId();
      const key = `ai_logger_permission_${currentPlatform}_${conversationId}`;
      
      const result = await chrome.storage.local.get([key]);
      return result[key] === true;
    } catch (error) {
      console.error('Error checking existing permission:', error);
      return false;
    }
  },

  // Clear all stored permissions
  clearAllPermissions: function() {
    chrome.storage.local.get(null, (items) => {
      const permissionKeys = Object.keys(items).filter(key => 
        key.startsWith('ai_logger_permission_')
      );
      
      if (permissionKeys.length > 0) {
        chrome.storage.local.remove(permissionKeys, () => {
          console.log('Cleared all AI logging permissions');
        });
      }
    });
  }
};
