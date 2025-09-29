/**
 * Popup UI Script
 * Handles the extension popup interface
 */

console.log('Data Logger: Popup script loaded');

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Data Logger: Popup UI initialized');
  
  // Setup collapsible row buttons
  setupCollapsibleRows();
  
  // Setup document URL input
  setupDocumentUrlInput();
  
  // Setup feedback functionality
  setupFeedbackInput();
  
  // Load tracked data
  loadTrackedDocuments();
  loadAIConversations();
});

// Setup collapsible row functionality
function setupCollapsibleRows() {
  const rowButtons = document.querySelectorAll('.row-button');
  
  rowButtons.forEach(button => {
    button.addEventListener('click', () => {
      const rowId = button.id.replace('-button', '');
      const content = document.getElementById(`${rowId}-content`);
      const arrow = button.querySelector('.arrow');
      
      // Toggle expanded state
      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.classList.add('expanded');
        button.classList.add('expanded');
      } else {
        content.classList.remove('expanded');
        content.classList.add('hidden');
        button.classList.remove('expanded');
      }
    });
  });
}

// Load tracked Google Docs
async function loadTrackedDocuments() {
  const docList = document.getElementById('doc-list');
  
  try {
    // Get user ID from storage
    const result = await chrome.storage.local.get(['keystroke_logger_user_id']);
    const userId = result.keystroke_logger_user_id;
    
    if (!userId) {
      docList.innerHTML = '<p class="no-data">No user ID found. Please visit a Google Doc to start tracking.</p>';
      return;
    }
    
    // Query the API for tracked documents
    // const response = await fetch(`http://localhost:3000/api/keystroke-logs?user_id=${userId}&limit=1000`); // Local development
    const response = await fetch(`https://branch-for-writing-376h.vercel.app/api/keystroke-logs?user_id=${userId}&limit=1000`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    
    const data = await response.json();
    
    if (!data.logs || data.logs.length === 0) {
      docList.innerHTML = '<p class="no-data">No documents tracked yet.</p>';
      return;
    }
    
    // Extract ALL document IDs (including duplicates with full doc_id)
    const docIds = data.logs.map(log => log.docId);
    
    // Create simple list HTML
    let html = '<div class="doc-id-list">';
    docIds.forEach(docId => {
      html += `<div class="doc-id-item">${docId}</div>`;
    });
    html += '</div>';
    
    docList.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading documents:', error);
    docList.innerHTML = '<p class="no-data">Error loading documents. Please ensure the server is running.</p>';
  }
}

// Load AI conversations
async function loadAIConversations() {
  const chatList = document.getElementById('chat-list');
  
  try {
    // Get user ID from storage
    const result = await chrome.storage.local.get(['keystroke_logger_user_id']);
    const userId = result.keystroke_logger_user_id;
    
    if (!userId) {
      chatList.innerHTML = '<p class="no-data">No user ID found. Please visit an AI platform to start tracking.</p>';
      return;
    }
    
    // Fetch AI conversations from the API
    console.log('Fetching AI conversations for user:', userId);
    // const response = await fetch(`http://localhost:3000/api/ai-platform-messages?user_id=${userId}&limit=1000`); // Local development
    const response = await fetch(`https://branch-for-writing-376h.vercel.app/api/ai-platform-messages?user_id=${userId}&limit=1000`);
    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`Failed to fetch AI conversations: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Received AI conversations data:', data);
    
    if (!data.conversations || data.conversations.length === 0) {
      chatList.innerHTML = '<p class="no-data">No AI conversations tracked yet. Visit ChatGPT, Claude, or Gemini to start tracking.</p>';
      return;
    }
    
    // Sort conversations by last message time (most recent first)
    const sortedConversations = data.conversations.sort((a, b) => {
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });
    
    // Create HTML for conversation list
    let html = '<div class="conversation-list">';
    
    sortedConversations.forEach(conv => {
      const platformName = conv.platform.charAt(0).toUpperCase() + conv.platform.slice(1);
      
      // Get conversation URL
      const conversationUrl = getConversationUrl(conv.platform, conv.conversationId);
      
      html += `
        <div class="conversation-item-simple">
          <span class="platform-name">${platformName}</span>
          <span class="separator">|</span>
          <span class="conversation-id-simple">${conv.conversationId}</span>
          <span class="separator">|</span>
          <a href="${conversationUrl}" target="_blank" class="conversation-link-simple">link →</a>
        </div>
      `;
    });
    
    html += '</div>';
    chatList.innerHTML = html;
    
  } catch (error) {
    console.error('Error loading AI conversations:', error);
    chatList.innerHTML = `<p class="no-data">Error loading conversations: ${error.message}</p>`;
  }
}

// Get conversation URL from platform and conversation ID
function getConversationUrl(platform, conversationId) {
  switch (platform) {
    case 'chatgpt':
      return `https://chatgpt.com/c/${conversationId}`;
    case 'claude':
      return `https://claude.ai/chat/${conversationId}`;
    case 'gemini':
      return `https://gemini.google.com/app/${conversationId}`;
    default:
      return '#';
  }
}

// Setup document URL input functionality
function setupDocumentUrlInput() {
  const input = document.getElementById('doc-url-input');
  const saveButton = document.getElementById('save-doc-url');
  const statusMessage = document.getElementById('doc-url-status');
  const trackedDocDisplay = document.getElementById('tracked-doc-display');
  
  // Load and display currently tracked documents
  loadTrackedDocuments();
  
  // Save button click handler
  saveButton.addEventListener('click', async () => {
    const url = input.value.trim(); // Clean up spaces
    
    if (!url) {
      showStatus('Please enter a Google Doc URL', 'error');
      return;
    }
    
    // Extract document ID from URL
    const docId = extractDocIdFromUrl(url);
    
    if (!docId) {
      showStatus('Invalid Google Doc URL. Please enter a valid link.', 'error');
      return;
    }
    
    // Add to tracked documents list
    try {
      // Get existing tracked documents
      const result = await chrome.storage.local.get(['tracked_doc_ids']);
      let trackedDocIds = result.tracked_doc_ids || [];
      
      // Check if document is already in the list
      if (trackedDocIds.includes(docId)) {
        showStatus('This document is already being tracked!', 'error');
        return;
      }
      
      // Add new document to the list
      trackedDocIds.push(docId);
      
      // Save updated list to storage
      await chrome.storage.local.set({ 'tracked_doc_ids': trackedDocIds });
      showStatus('Document added successfully!', 'success');
      input.value = '';
      
      // Update display
      loadTrackedDocuments();
      
      // Hide status after 3 seconds
      setTimeout(() => {
        statusMessage.classList.remove('show');
      }, 3000);
    } catch (error) {
      console.error('Error saving document:', error);
      showStatus('Error saving document. Please try again.', 'error');
    }
  });
  
  // Allow Enter key to save
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveButton.click();
    }
  });
}

// Extract document ID from Google Docs URL
function extractDocIdFromUrl(url) {
  // Clean up the URL (trim spaces)
  url = url.trim();
  
  // Match Google Docs URL pattern: /d/DOCUMENT_ID/
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

// Load and display all tracked documents
async function loadTrackedDocuments() {
  const trackedDocDisplay = document.getElementById('tracked-doc-display');
  
  try {
    const result = await chrome.storage.local.get(['tracked_doc_ids']);
    const trackedDocIds = result.tracked_doc_ids || [];
    
    if (trackedDocIds.length > 0) {
      let html = '<div class="label">Currently tracking:</div>';
      html += '<div class="tracked-docs-list">';
      
      trackedDocIds.forEach((docId, index) => {
        html += `
          <div class="tracked-doc-item">
            <div class="doc-id">${docId}</div>
          </div>
        `;
      });
      
      html += '</div>';
      
      trackedDocDisplay.innerHTML = html;
      trackedDocDisplay.classList.add('show');
    } else {
      trackedDocDisplay.classList.remove('show');
    }
  } catch (error) {
    console.error('Error loading tracked documents:', error);
  }
}

// Show status message
function showStatus(message, type) {
  const statusMessage = document.getElementById('doc-url-status');
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type} show`;
}

// Setup feedback input functionality
function setupFeedbackInput() {
  const textarea = document.getElementById('feedback-textarea');
  const sendButton = document.getElementById('send-feedback-button');
  const feedbackStatus = document.getElementById('feedback-status');
  
  // Send button click handler
  sendButton.addEventListener('click', async () => {
    await sendFeedback();
  });
  
  // Allow Enter key to send (Shift+Enter for new line)
  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default newline
      await sendFeedback();
    }
  });
  
  // Function to send feedback
  async function sendFeedback() {
    const content = textarea.value.trim();
    
    if (!content) {
      showFeedbackStatus('Please enter some feedback', 'error');
      return;
    }
    
    try {
      // Get user ID from storage
      const result = await chrome.storage.local.get(['keystroke_logger_user_id']);
      const userId = result.keystroke_logger_user_id;
      
      if (!userId) {
        showFeedbackStatus('No user ID found. Please visit a Google Doc first.', 'error');
        return;
      }
      
      // Send feedback to API
      console.log('Sending feedback for user:', userId);
      // const response = await fetch('http://localhost:3000/api/user-feedback', { // Local development
      const response = await fetch('https://branch-for-writing-376h.vercel.app/api/user-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          content: content
        })
      });
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Failed to submit feedback: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        showFeedbackStatus('Thank you! Feedback submitted successfully.', 'success');
        textarea.value = ''; // Clear the textarea
        
        // Hide status after 3 seconds
        setTimeout(() => {
          feedbackStatus.classList.remove('show');
        }, 3000);
      } else {
        showFeedbackStatus('Failed to submit feedback. Please try again.', 'error');
      }
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showFeedbackStatus(`Error submitting feedback: ${error.message}`, 'error');
    }
  }
  
  // Show feedback status message
  function showFeedbackStatus(message, type) {
    feedbackStatus.textContent = message;
    feedbackStatus.className = `status-message ${type} show`;
  }
}
