# Popup UI - Feature Documentation

## Overview
The Writing Research Data Logger extension now has a fully functional popup UI for research participants.

## UI Components

### Header
- **Title**: "Writing Research Data Logger" (non-bold, normal weight)
- **Subtitle**: "Thank you for participating!" (gray text)
- Black bottom border

### Main Content - Three Collapsible Rows

#### 1. Google Docs Tracking
- **Functionality**: Click to expand and view all tracked Google Docs
- **Features**:
  - Shows clickable links to all tracked documents
  - Displays edit count per document
  - Shows last edited timestamp
  - Links open in new tab
- **Data Source**: Fetches from `/api/keystroke-logs` endpoint
- **Handles**:
  - No user ID scenario
  - No documents tracked yet
  - Server connection errors

#### 2. AI Chat Tracking
- **Functionality**: Click to expand and view AI conversation history
- **Status**: Placeholder (API endpoint not yet implemented)
- **Future Features**: Will show ChatGPT, Claude, and Gemini conversations

#### 3. Report Issues
- **Functionality**: Click to expand for contact information
- **Content**: Email link to report extension issues
- **Contact**: yy2228@cornell.edu

### Footer
- **Text**: "Contact research team to delete records if needed"
- **Email**: yy2228@cornell.edu (orange accent color)
- Gray text, centered

## Design System

### Colors
- **Primary**: Black (#000000) and White (#ffffff)
- **Accent**: Orange (#ff6600) for links
- **Secondary**: Gray (#666666) for subtitles and info text
- **Dividers**: Light gray (#cccccc)

### Typography
- **Font**: Atkinson Hyperlegible (all text)
- **Sizes**:
  - Title: 20px (normal weight)
  - Row titles: 15px
  - Body text: 13px
  - Footer: 11-12px

### Layout
- **Width**: 450px
- **Min Height**: 400px
- **Max Height**: 600px with scroll
- **Padding**: Consistent 20px outer, 12-16px inner

## Functionality

### Collapsible Rows
- Click any row to expand/collapse
- Arrow indicator rotates 90° when expanded
- Smooth animation transitions
- Only one section can be expanded at a time (independent)

### Google Docs Loading
1. Retrieves user ID from Chrome storage
2. Queries API with user ID
3. Extracts unique document IDs
4. Creates clickable links with metadata
5. Handles errors gracefully

### Error Handling
- No user ID: Prompts to visit Google Doc
- No data: Shows "No documents tracked yet"
- Server error: Shows helpful error message
- Network error: Caught and displayed

## Testing

### To Test the Popup:
1. Load extension in `chrome://extensions/`
2. Click extension icon in toolbar
3. Click "Google Docs Tracking" to expand
4. Verify document links appear (if server running)
5. Click document links to open in new tab
6. Test other collapsible sections

### Prerequisites:
- Extension loaded in Chrome
- User has visited Google Docs (to generate user ID)
- Local server running at `localhost:3000`
- Database contains keystroke logs

## Future Enhancements

### Planned Features:
- [ ] AI conversation history display
- [ ] Real-time status indicators
- [ ] User consent toggles
- [ ] Data export functionality
- [ ] Advanced filtering options
- [ ] Search functionality

### API Dependencies:
- ✅ `/api/keystroke-logs` - Implemented
- ⏸️ `/api/ai-platform-messages` - Pending implementation

## File Structure

```
data-logger-chrome-extension/
├── popup.html       # Main popup structure
├── popup.css        # Styling (black/white/orange theme)
├── popup.js         # Functionality and API calls
├── manifest.json    # Updated with action configuration
└── icon.png         # Extension icon
```

## Contact
For questions or issues: yy2228@cornell.edu
