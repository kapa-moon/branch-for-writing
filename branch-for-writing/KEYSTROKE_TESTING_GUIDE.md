# Keystroke Logger Chrome Extension - Testing Guide

This guide provides step-by-step instructions for installing, testing, and verifying the Chrome extension for keystroke logging in Google Docs.

## Prerequisites

1. **Backend Server Running**: Ensure your Next.js server is running on `http://localhost:3000`
2. **Database Setup**: Run the database migration to create the `keystroke_logs` table
3. **Chrome Browser**: Version 88+ (for Manifest V3 support)

## Step 1: Database Setup

### Run the Migration

```bash
# Navigate to your project directory
cd branch-for-writing

# Run the database migration
npx drizzle-kit push:pg
# or if using a different setup:
# npm run db:migrate
```

### Verify Database Schema

Connect to your database and verify the `keystroke_logs` table was created:

```sql
-- Check if table exists
\dt keystroke_logs

-- Verify table structure
\d keystroke_logs
```

Expected columns:
- `id`, `doc_id`, `user_id`, `session_id`
- `timestamp`, `before_text`, `after_text`
- `diff_data` (jsonb), `action_type`
- `cursor_position`, `text_length_before`, `text_length_after`
- `keystroke_count`, `created_at`, `updated_at`

## Step 2: Start Your Backend Server

```bash
# In your project directory
npm run dev
# or
pnpm dev
```

Verify the API endpoint is working:
```bash
curl http://localhost:3000/api/keystroke-logs
```

Expected response:
```json
{
  "success": true,
  "logs": [],
  "count": 0,
  "filters": {...}
}
```

## Step 3: Install Chrome Extension

### Load Extension in Developer Mode

1. **Open Chrome Extensions Page**:
   - Go to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**:
   - Toggle "Developer mode" in the top-right corner

3. **Load Unpacked Extension**:
   - Click "Load unpacked"
   - Navigate to your `branch-for-writing/data-logger-chrome-extension/` folder
   - Select the folder and click "Open"

4. **Verify Installation**:
   - Extension should appear in the list as "Google Docs Keystroke Logger"
   - Status should show "Enabled"
   - Note the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz`)

### Troubleshooting Installation

**If you get errors:**

- **Manifest errors**: Check `manifest.json` syntax
- **Missing files**: Ensure all files are present:
  - `manifest.json`
  - `content.js`  
  - `background.js`
  - `lib/diff_match_patch.js`

**If diff_match_patch.js is missing:**
```bash
cd branch-for-writing/data-logger-chrome-extension/lib
curl -o diff_match_patch.js https://raw.githubusercontent.com/google/diff-match-patch/master/javascript/diff_match_patch_uncompressed.js
```

## Step 4: Test in Google Docs

### Create a Test Document

1. **Open Google Docs**: Go to [docs.google.com](https://docs.google.com)
2. **Create New Document**: Click "Blank document"
3. **Wait for Load**: Ensure the document fully loads

### Verify Extension Initialization

1. **Open Browser Console**:
   - Press `F12` or right-click → "Inspect"
   - Go to "Console" tab

2. **Look for Extension Messages**:
   ```
   Keystroke Logger: Content script loaded
   Keystroke Logger: Initializing...
   Keystroke Logger: User ID initialized: user_xyz123
   Keystroke Logger: Initialized successfully
   Doc ID: 1234567890abcdef, User ID: user_xyz123
   Keystroke Logger: Event listeners setup complete
   ```

**If you don't see these messages:**
- Refresh the page
- Check if extension is enabled
- Verify you're on a Google Docs document URL (`https://docs.google.com/document/...`)

### Test Basic Keystroke Logging

1. **Type in Document**: Start typing some text
2. **Monitor Console**: You should see:
   ```
   Keystroke Logger: insert - 5 chars
   Keystroke Logger: insert - 12 chars
   ```

3. **Delete Text**: Use backspace/delete
   ```
   Keystroke Logger: delete - 8 chars
   ```

4. **Paste Text**: Copy and paste some text
   ```
   Keystroke Logger: paste - 25 chars
   ```

### Test Batch Sending

1. **Type Several Characters**: The extension sends batches every 5 edits
2. **Watch for Batch Messages**:
   ```
   Keystroke Logger: Sending batch of 5 entries
   Keystroke Logger: Batch sent successfully
   ```

**If batch sending fails:**
- Check Network tab in DevTools for failed requests
- Verify your backend server is running
- Check API endpoint URL in `content.js`

## Step 5: Verify Data in Database

### Query the Database

```sql
-- Check if data is being inserted
SELECT COUNT(*) FROM keystroke_logs;

-- View recent logs
SELECT 
  id, 
  doc_id, 
  action_type, 
  text_length_before, 
  text_length_after, 
  timestamp 
FROM keystroke_logs 
ORDER BY timestamp DESC 
LIMIT 10;

-- View diff data
SELECT 
  id,
  action_type,
  diff_data,
  before_text,
  after_text
FROM keystroke_logs
WHERE action_type = 'insert'
LIMIT 5;
```

### Expected Data Structure

Each log entry should contain:
- **Unique ID**: Generated timestamp-based ID
- **Doc ID**: Google Docs document identifier
- **User ID**: Extension-generated user identifier  
- **Session ID**: Unique session identifier
- **Diff Data**: JSON array like `[[0,"same"],[1,"new"]]`
- **Action Type**: `insert`, `delete`, `replace`, `paste`
- **Text Lengths**: Before and after character counts

## Step 6: Advanced Testing

### Test Different Actions

1. **Typing**: Regular character input
2. **Backspace/Delete**: Text deletion
3. **Copy/Paste**: Large text insertion
4. **Undo/Redo**: Using Ctrl+Z, Ctrl+Y
5. **Selection Replace**: Select text and type over it

### Test Edge Cases

1. **Empty Document**: Start with blank doc
2. **Large Paste**: Paste a very long text
3. **Rapid Typing**: Type very quickly
4. **Special Characters**: Test unicode, emojis
5. **Multiple Sessions**: Open multiple docs

### Monitor Performance

1. **Check Memory Usage**: 
   - Go to `chrome://extensions/`
   - Click "Details" on your extension
   - Monitor memory usage

2. **Network Traffic**:
   - Open DevTools → Network tab
   - Filter for your API endpoint
   - Monitor request frequency and size

## Step 7: Test API Endpoint Directly

### Test with curl

```bash
# Test POST with sample data
curl -X POST http://localhost:3000/api/keystroke-logs \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [{
      "id": "test123",
      "doc_id": "test_doc",
      "user_id": "test_user",
      "session_id": "test_session",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "before_text": "hello",
      "after_text": "hello world",
      "diff_data": [[0, "hello"], [1, " world"]],
      "action_type": "insert",
      "cursor_position": 5,
      "text_length_before": 5,
      "text_length_after": 11,
      "keystroke_count": 1
    }]
  }'

# Test GET to retrieve data
curl "http://localhost:3000/api/keystroke-logs?limit=5"
```

## Troubleshooting Common Issues

### Extension Not Working

1. **Check Extension Status**:
   ```javascript
   // In browser console on Google Docs
   chrome.runtime.sendMessage({type: 'GET_EXTENSION_ID'}, response => {
     console.log('Extension ID:', response?.extensionId);
   });
   ```

2. **Verify Content Script Injection**:
   - Check if `content.js` is listed in DevTools → Sources tab
   - Look for console messages from the extension

### No Data in Database

1. **Check API Endpoint**:
   - Verify server is running
   - Test endpoint with curl
   - Check for CORS issues

2. **Check Network Requests**:
   - Open DevTools → Network tab
   - Look for failed POST requests to `/api/keystroke-logs`
   - Check request/response details

### Performance Issues

1. **Reduce Batch Size**: Edit `BATCH_SIZE` in `content.js`
2. **Increase Send Interval**: Modify `SEND_INTERVAL`
3. **Check Memory Leaks**: Monitor extension memory usage

### Google Docs Changes

If Google Docs updates break the extension:

1. **Update Selectors**: Check if Google changed CSS classes
2. **Test New Approaches**: Try different ways to access editor content
3. **Check Console Errors**: Look for DOM-related errors

## Validation Checklist

- [ ] Database migration completed successfully
- [ ] Backend server running on localhost:3000
- [ ] Chrome extension installed and enabled
- [ ] Extension initializes on Google Docs pages
- [ ] Console shows keystroke logging messages
- [ ] Batch sending works without errors
- [ ] Data appears in database with correct structure
- [ ] All action types work (insert, delete, paste, etc.)
- [ ] Diff data is properly formatted JSON
- [ ] No console errors or network failures
- [ ] Extension works across multiple documents
- [ ] Session IDs are unique per session

## Next Steps

Once testing is complete:

1. **Deploy Backend**: Deploy your API to production
2. **Update Extension**: Change API_URL to production endpoint
3. **Package Extension**: Create a .zip file for distribution
4. **Monitor Logs**: Set up logging and monitoring for production use

## Support

If you encounter issues:

1. Check browser console for error messages
2. Verify all files are present and properly formatted
3. Test API endpoint independently
4. Check database connectivity and permissions
5. Review Chrome extension permissions and manifest

For production deployment, consider:
- Error handling and retry mechanisms
- Data compression for large text blocks
- User consent and privacy compliance
- Rate limiting and abuse prevention