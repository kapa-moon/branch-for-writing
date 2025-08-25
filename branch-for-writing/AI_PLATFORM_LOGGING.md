# AI Platform Message Logging

This extension now supports logging conversations from AI platforms like ChatGPT, Claude, and Gemini. All messages are stored in the database with proper user identification, conversation tracking, and user permission controls.

## Features

### Database Schema
- **Table**: `ai_platform_messages`
- **Fields**:
  - `id`: Unique message identifier
  - `platform`: AI platform name (e.g., 'chatgpt', 'claude', 'gemini')
  - `conversation_id`: Unique conversation/thread identifier
  - `message_id`: Platform-specific message ID to prevent duplicates
  - `sender`: 'user' or 'ai'
  - `content`: Message text content
  - `timestamp`: When the message was sent/received
  - `metadata`: Additional platform-specific data (JSON)
  - `user_id`: Associated user identifier

### User ID Management
- **Persistent**: User ID is stored in Chrome's local storage and persists across sessions
- **Machine-specific**: Uses system information to generate a unique machine identifier
- **Cross-platform**: Same user ID is used for all AI platforms on the same computer
- **Privacy**: No personally identifiable information is collected

### Permission System
- **Permission Popup**: Users are prompted for permission before logging each new conversation
- **Conversation-based**: Permissions are stored per conversation, not globally
- **Smart Detection**: No popup if conversation already exists in database
- **Remember Choice**: Users can choose to remember their decision for each conversation
- **Privacy Controls**: Users can clear all permissions at any time

### Supported Platforms
- **ChatGPT** (chatgpt.com, chat.openai.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- Extensible for other AI platforms

## Extension Architecture

The extension has been refactored into a modular structure:

```
data-logger-chrome-extension/
├── modules/
│   ├── platform-detector.js      # Platform detection and URL parsing
│   ├── user-management.js        # User ID generation and management
│   ├── ai-platform-logger.js     # AI platform message extraction and logging
│   ├── google-docs-logger.js     # Google Docs keystroke logging
│   └── permission-popup.js       # Permission popup UI and logic
├── content-new.js                # Main orchestrator script
├── content-old.js                # Legacy monolithic script (backup)
├── extractor.js                  # Google Docs text extraction
├── background.js                 # Background service worker
└── manifest.json                 # Extension configuration
```

## API Endpoints

### POST /api/ai-platform-messages
Logs a new AI platform message.

**Request Body**:
```json
{
  "id": "unique_message_id",
  "platform": "chatgpt",
  "conversationId": "conversation_identifier",
  "messageId": "platform_specific_id",
  "sender": "user|ai",
  "content": "message content",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "metadata": { "url": "...", "userAgent": "..." },
  "userId": "user_identifier"
}
```

### GET /api/ai-platform-messages
Retrieves AI platform messages.

**Query Parameters**:
- `userId` (required): User identifier
- `platform` (optional): Filter by platform
- `conversationId` (optional): Filter by conversation
- `limit` (optional): Number of messages to return (default: 100)

## Console Functions

The extension provides several debugging functions accessible from the browser console:

### `testAIPlatformExtraction()`
Tests the AI platform message extraction functionality for the current platform.

### `testAIMessageSending()`
Tests sending a message to the database API.

### `getUserInfo()`
Displays current user ID and platform information.

### `resetUserID()`
Clears the stored user ID and machine ID (requires page refresh).

### `exportUserData()`
Exports user data as a JSON file.

### `clearAllPermissions()`
Clears all stored AI logging permissions.

### `testChatGPTExtraction()`
Legacy function for testing ChatGPT message extraction (only works on ChatGPT).

## Permission Popup

When users visit an AI platform for the first time with a new conversation, they will see a permission popup that:

1. **Explains what will be logged**: Message content, timestamps, conversation ID, platform info
2. **Privacy notice**: No personal info collected, data stored securely, user control
3. **Clear options**: Allow or deny logging
4. **Remember choice**: Option to remember decision for this conversation
5. **Smart detection**: No popup if conversation already exists in database

### Popup Features
- **Modern UI**: Clean, professional design with clear information
- **Accessibility**: Keyboard navigation (Escape to close)
- **Responsive**: Works on different screen sizes
- **Non-intrusive**: Can be dismissed by clicking outside
- **Platform-specific**: Shows correct platform name and conversation ID

## Privacy and Data Management

### What's Collected
- Message content from AI conversations
- Timestamps
- Platform information
- Conversation identifiers
- Machine-specific identifiers (not personally identifiable)

### What's NOT Collected
- Personal information (name, email, etc.)
- Login credentials
- Browser history outside of AI platforms
- Keystrokes outside of Google Docs

### Data Control
- Users can reset their user ID at any time
- Users can export their data
- Users can clear all permissions
- All data is associated with a machine-specific identifier, not personal information
- Permission is required for each new conversation

## Installation and Setup

1. Load the extension in Chrome
2. Navigate to any supported AI platform (ChatGPT, Claude, or Gemini)
3. The extension will show a permission popup for new conversations
4. After granting permission, the extension will automatically start monitoring conversations
5. Check the browser console for debugging information

## Troubleshooting

### Messages Not Being Logged
1. Check browser console for errors
2. Verify the API endpoint is accessible
3. Run `testAIMessageSending()` to test connectivity
4. Check if permission was granted for the conversation

### Permission Issues
1. Run `clearAllPermissions()` to reset all permissions
2. Refresh the page to trigger a new permission request
3. Check if the conversation already exists in the database

### User ID Issues
1. Run `getUserInfo()` to check current user ID
2. Use `resetUserID()` if you need a new identifier
3. Refresh the page after resetting

### Platform Detection Issues
1. Check if the platform is supported
2. Verify the URL matches the expected patterns
3. Check console logs for platform detection messages

## Migration from Old Version

The extension has been refactored from a monolithic structure to a modular one:

- **Old**: Single `content.js` file with all functionality
- **New**: Modular structure with separate concerns
- **Backup**: `content-old.js` contains the original implementation
- **Compatibility**: All existing functionality preserved
- **New Features**: Permission popup and improved organization

To migrate:
1. The new version will automatically replace the old one
2. All existing data and permissions are preserved
3. New conversations will show the permission popup
4. Existing conversations will continue to work without interruption
