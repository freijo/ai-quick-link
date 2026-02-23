# Chrome Web Store Permission Justification

## system.display API

### Purpose
The `system.display` permission is required to implement the **"Tab Split View"** feature introduced in version 1.5. This feature allows users to view their source webpage and the AI assistant side-by-side.

### How It's Used
When the user enables "Split Tab View" in the extension options and triggers the extension (via Alt+A hotkey or context menu):

1. The extension retrieves the primary display's dimensions using `chrome.system.display.getInfo()`
2. It calculates half the screen width
3. It resizes the current window (source webpage) to occupy the left 50% of the screen
4. It creates a new window (AI assistant) positioned on the right 50% of the screen

### Why This Permission Is Necessary
- **Service Worker Context**: The extension uses Manifest V3 with a service worker background script. The standard `screen` object is not available in service workers.
- **Accurate Dimensions**: `chrome.system.display` provides accurate work area dimensions (accounting for taskbars, docks, etc.) for proper window positioning.
- **Multi-Monitor Support**: The API handles multi-display setups correctly by identifying the primary display.

### User Control
- This feature is **opt-in** (disabled by default)
- Users can toggle it on/off in the extension options
- When disabled, the extension opens AI assistants in a new tab within the same window (original behavior)

### Privacy
- No display data is collected, stored, or transmitted
- The API is only called when the split view feature is actively used
- No remote servers are contacted for this functionality