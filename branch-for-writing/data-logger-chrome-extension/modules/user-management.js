// User management module - Non-module version for Chrome extensions
window.UserManagement = {
  idCounter: 0,

  generateId: function() {
    this.idCounter++;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const counter = this.idCounter.toString(36);
    return `${timestamp}_${random}_${counter}`;
  },

  // Generate a machine-specific ID that persists across sessions
  generateMachineId: async function() {
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
  },

  // Initialize user ID from storage or generate new one
  initializeUserId: async function() {
    try {
      // Try to get existing user ID from storage
      const result = await chrome.storage.local.get(['keystroke_logger_user_id']);
      
      if (result.keystroke_logger_user_id) {
        console.log('Extension: Using existing User ID:', result.keystroke_logger_user_id);
        return result.keystroke_logger_user_id;
      } else {
        // Generate a new persistent user ID
        // Use a combination of machine-specific info and timestamp for uniqueness
        const machineId = await this.generateMachineId();
        const userId = `user_${machineId}_${Date.now()}`;
        
        // Store it permanently
        await chrome.storage.local.set({keystroke_logger_user_id: userId});
        console.log('Extension: Generated new persistent User ID:', userId);
        return userId;
      }
    } catch (error) {
      console.error('Error initializing user ID:', error);
      // Fallback: generate a temporary ID
      const tempUserId = 'user_temp_' + this.generateId();
      return tempUserId;
    }
  },

  // User ID management functions (accessible from console)
  getUserInfo: function(userId) {
    console.log('=== USER ID INFORMATION ===');
    console.log('Current User ID:', userId);
    console.log('Current URL:', window.location.href);
    
    // Get stored data
    chrome.storage.local.get(['keystroke_logger_user_id', 'machine_id'], (result) => {
      console.log('Stored User ID:', result.keystroke_logger_user_id);
      console.log('Machine ID:', result.machine_id);
    });
  },

  resetUserID: function() {
    console.log('=== RESETTING USER ID ===');
    chrome.storage.local.remove(['keystroke_logger_user_id', 'machine_id'], () => {
      console.log('User ID and Machine ID cleared from storage');
      console.log('Please refresh the page to generate a new User ID');
    });
  },

  exportUserData: function(userId, currentPlatform) {
    console.log('=== EXPORTING USER DATA ===');
    const data = {
      userId: userId,
      platform: currentPlatform,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      extensionVersion: '1.1'
    };
    
    // Create download link
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-data-${userId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('User data exported:', data);
  }
};
