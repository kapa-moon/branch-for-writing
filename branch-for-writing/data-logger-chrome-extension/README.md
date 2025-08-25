# Multi-Platform Data Logger Chrome Extension

A Chrome extension for data logging across multiple platforms:
- **Google Docs**: Real-time keystroke logging with diff tracking using [diff-match-patch](https://github.com/google/diff-match-patch)
- **ChatGPT**: Conversation monitoring and message extraction

## Features

### Google Docs
- **Real-time keystroke capture**: Monitors every keyup, input, paste, and focus event
- **Multi-tab support**: Detects and handles multiple tabs within Google Docs documents
- **Diff tracking**: Uses Google's diff-match-patch to generate precise change differences
- **Batch processing**: Efficiently sends data in batches to reduce API calls
- **Session tracking**: Groups keystrokes by session and tab for analysis
- **Multiple event support**: Captures typing, paste, undo/redo, and navigation events
- **Smart cursor tracking**: Advanced cursor position detection with multiple fallback methods

### ChatGPT
- **Conversation monitoring**: Real-time detection of new messages in ChatGPT conversations
- **Message extraction**: Captures both user and AI messages with timestamps
- **Duplicate prevention**: Prevents logging the same message multiple times
- **Silent operation**: Runs in the background without disrupting conversations

## File Structure

```
data-logger-chrome-extension/
├── manifest.json           # Extension manifest and configuration
├── content.js             # Main content script for keystroke logging
├── background.js          # Background service worker
├── lib/
│   └── diff_match_patch.js # Google's diff-match-patch library
└── README.md              # This file
```

## Data Captured

### Google Docs Keystroke Events
Each keystroke event captures:

- **Document ID**: Extracted from Google Docs URL + Tab ID for multi-tab support
- **User ID**: Generated unique identifier stored in Chrome storage
- **Session ID**: Unique session identifier per tab
- **Timestamps**: Precise timing of each event
- **Text states**: Before and after text for each change
- **Diff data**: Structured differences using diff-match-patch
- **Action type**: insert, delete, replace, paste, etc.
- **Cursor position**: Real-time cursor/selection tracking with multiple detection methods
- **Text metrics**: Character counts and keystroke counts
- **Tab tracking**: Each Google Docs tab is tracked separately

### ChatGPT Conversation Messages
Each message captures:

- **Message ID**: Unique identifier from ChatGPT's DOM
- **Sender**: 'user' or 'ai' (assistant)
- **Timestamp**: When the message was detected/logged
- **Text**: Clean message content extracted from StaticText elements

## API Endpoint

The extension sends data to: `http://localhost:3000/api/keystroke-logs`

### Request Format

```json
{
  "logs": [
    {
      "id": "unique_id",
      "doc_id": "google_doc_id",
      "user_id": "user_identifier",
      "session_id": "session_identifier",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "before_text": "previous text",
      "after_text": "updated text",
      "diff_data": [[0, "same"], [1, "inserted"], [-1, "deleted"]],
      "action_type": "insert",
      "cursor_position": 42,
      "text_length_before": 100,
      "text_length_after": 105,
      "keystroke_count": 1
    }
  ]
}
```

### Response Format

```json
{
  "success": true,
  "message": "Inserted 5 keystroke logs",
  "processed": 5,
  "total_received": 5
}
```

## Configuration

Edit `content.js` to modify:

- **API_URL**: Your backend endpoint URL
- **BATCH_SIZE**: Number of events before sending (default: 5)
- **SEND_INTERVAL**: Automatic send interval in ms (default: 15000)

## Browser Console Debugging

The extension logs detailed information to the browser console:

### Google Docs
```javascript
// Check if extension is loaded
console.log('Keystroke Logger: Content script loaded');
console.log('Platform detected: google_docs');

// Monitor initialization
console.log('Extension: Initialized successfully');
console.log('Doc ID: 1234567890, User ID: user_abc123');

// Track individual events
console.log('Extension: insert - 105 chars');

// Monitor batch sending
console.log('Extension: Sending batch of 5 entries');
console.log('Extension: Batch sent successfully');

// Manual testing
testExtensionTextExtraction(); // Test text extraction
testCursorPosition(); // Test cursor position tracking
testMultiTab(); // Test multi-tab functionality
forceTabReinit(); // Force reinitialization of current tab
debugActiveContent(); // Debug active content detection
```

### ChatGPT
```javascript
// Platform detection
console.log('Platform detected: chatgpt');

// Monitor conversation
console.log('ChatGPT: Initializing conversation monitoring...');
console.log('ChatGPT: Found 3 existing messages');

// New message detection
console.log('ChatGPT: New message -', {
  messageId: "730d0cbc-6e0b-4774-b7dc-355701263f5b",
  sender: "user",
  timestamp: "2024-01-01T12:00:00.000Z",
  text: "what to ask?"
});

// Manual testing
testChatGPTExtraction(); // Test message extraction on current page
```

## Privacy & Security

- User IDs are anonymized and generated locally
- No personal information is transmitted
- Only document text content and edit patterns are captured
- All data is sent to your own backend endpoint
- Chrome extension permissions are minimal and specific

## Troubleshooting

### Extension not loading
1. **Google Docs**: Check that you're on a Google Docs page: `https://docs.google.com/document/*`
2. **ChatGPT**: Check that you're on ChatGPT: `https://chatgpt.com/*` or `https://chat.openai.com/*`
3. Verify the extension is enabled in Chrome Extensions
4. Check browser console for error messages

### Tab switching not detected
1. Check console for "Extension: Tab/URL change detected!" messages
2. Run `testMultiTab()` to check tab detection
3. Use `forceTabReinit()` to manually reinitialize current tab
4. Verify URL contains `?tab=t.xxxxx` parameter when switching tabs

### Text content not updating for different tabs
1. Run `debugActiveContent()` to see which editors are detected as active
2. Check console for "Extension: Text change from editor X" messages
3. Verify that different tabs show different text lengths in the debug output
4. Look for "Active focused editor found" or "Visible editors found" messages

### No data being sent (Google Docs)
1. Verify your backend server is running
2. Check the API_URL in `content.js` matches your endpoint
3. Ensure CORS headers allow Chrome extension requests
4. Check network tab for failed requests

### Google Docs not detected
1. Try refreshing the page
2. Ensure you're in the document editor, not comments or suggestions
3. Check console for "Editor not found" messages

### ChatGPT messages not being captured
1. Check console for "Platform detected: chatgpt"
2. Look for "ChatGPT: Monitoring initialized successfully"
3. Run `testChatGPTExtraction()` in console to test extraction
4. Ensure you're in a conversation, not the home page
5. Try sending a new message to trigger detection

## Development

To modify the extension:

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click "Reload" on the extension
4. Refresh any Google Docs tabs

## Database Schema

The extension expects this database table structure:

```sql
CREATE TABLE "keystroke_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "doc_id" text NOT NULL,
  "user_id" text NOT NULL,
  "session_id" text NOT NULL,
  "timestamp" timestamp NOT NULL,
  "before_text" text NOT NULL,
  "after_text" text NOT NULL,
  "diff_data" jsonb NOT NULL,
  "action_type" text NOT NULL,
  "cursor_position" integer,
  "text_length_before" integer NOT NULL,
  "text_length_after" integer NOT NULL,
  "keystroke_count" integer DEFAULT 1,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);
```