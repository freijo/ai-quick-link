// background.js - Modul 14.1: V1.5 Tab Split Feature (Debug + Fix)

const DEFAULT_URLS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/"
};

// Debug logging
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log('[AI Quick Link]', ...args);
}

// Menü aufbauen
function rebuildContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "default_action",
      title: chrome.i18n.getMessage("contextMenuTitle"),
      contexts: ["selection"]
    });

    chrome.storage.sync.get({ quickPrompts: [] }, (items) => {
      const prompts = items.quickPrompts || [];
      if (prompts.length > 0) {
        chrome.contextMenus.create({ id: "sep1", type: "separator", contexts: ["selection"] });
        prompts.forEach(p => {
          chrome.contextMenus.create({
            id: p.id,
            title: p.name,
            contexts: ["selection"]
          });
        });
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => rebuildContextMenu());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.quickPrompts) rebuildContextMenu();
});

// --- CORE ACTION LOGIC ---

async function executeAction(tab, menuId, directTextFromMenu = null) {
  log('executeAction called', { tabId: tab?.id, menuId, hasDirectText: !!directTextFromMenu });
  
  if (!tab || tab.url.startsWith("chrome://")) {
    log('Invalid tab or chrome:// URL');
    return;
  }

  try {
    let textToProcess = "";

    // 1. Wenn Rechtsklick -> Nimm den Text direkt
    if (directTextFromMenu) {
      textToProcess = directTextFromMenu.trim();
      log('Text from context menu:', textToProcess.substring(0, 50));
    } 
    
    // 2. Wenn Hotkey (Alt+A) -> Suche den FOKUSSIERTEN Frame
    if (!textToProcess) {
      log('Injecting script to get selection...');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          return {
            text: window.getSelection().toString(),
            isFocused: document.hasFocus()
          };
        }
      });

      if (results && results.length > 0) {
        const focusedFrame = results.find(r => r.result && r.result.isFocused && r.result.text.trim().length > 0);
        
        if (focusedFrame) {
          textToProcess = focusedFrame.result.text.trim();
          log('Text from focused frame:', textToProcess.substring(0, 50));
        } else {
          const anyFrame = results.find(r => {
            const t = (r.result && r.result.text) ? r.result.text.trim() : "";
            const looksLikeTag = t.startsWith("<iframe") && t.endsWith(">");
            return t.length > 0 && !looksLikeTag;
          });

          if (anyFrame) {
            textToProcess = anyFrame.result.text.trim();
            log('Text from any frame:', textToProcess.substring(0, 50));
          }
        }
      }
    }

    if (!textToProcess) {
      log('No text found!');
      return;
    }

    // --- Load settings ---
    log('Loading settings...');
    const data = await chrome.storage.sync.get({
      selectedProvider: 'chatgpt',
      customProviders: [],
      customPrefix: '',
      customSuffix: '',
      quickPrompts: [],
      splitTab: false
    });
    
    log('Settings loaded:', { provider: data.selectedProvider, splitTab: data.splitTab });

    let prefix = "";
    let suffix = "";

    if (menuId === "default_action" || menuId === "hotkey") {
      prefix = data.customPrefix;
      suffix = data.customSuffix;
    } else {
      const prompt = data.quickPrompts.find(p => p.id === menuId);
      if (prompt) {
        prefix = prompt.prefix;
        suffix = prompt.suffix;
      }
    }

    let finalPayload = textToProcess;
    if (prefix && prefix.trim()) finalPayload = `${prefix}\n\n${finalPayload}`;
    if (suffix && suffix.trim()) finalPayload = `${finalPayload}\n\n${suffix}`;

    await chrome.storage.local.set({ pendingPrompt: finalPayload });

    const key = data.selectedProvider || 'chatgpt';
    let targetUrl = DEFAULT_URLS[key];
    
    if (!targetUrl) {
      const customP = (data.customProviders || []).find(c => c.key === key);
      if (customP) targetUrl = customP.url;
    }
    if (!targetUrl) targetUrl = DEFAULT_URLS['chatgpt'];
    
    log('Target URL:', targetUrl);

    // V1.5: Tab Split Logic (FIXED)
    if (data.splitTab) {
      log('SplitTab ENABLED - executing split logic');
      try {
        // Get display info for screen dimensions (service worker compatible)
        const displays = await chrome.system.display.getInfo();
        const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
        const workArea = primaryDisplay.workArea;
        
        log('Display info:', { width: workArea.width, height: workArea.height });
        
        const halfWidth = Math.round(workArea.width / 2);
        const fullHeight = workArea.height;
        const leftPosition = workArea.left;
        const rightPosition = workArea.left + halfWidth;

        // Get current window
        const currentWindow = await chrome.windows.get(tab.windowId);
        log('Current window:', { id: currentWindow.id, type: currentWindow.type, state: currentWindow.state });
        
        // Resize source window to left half
        if (currentWindow.type === 'normal') {
          log('Resizing source window to left half...');
          await chrome.windows.update(currentWindow.id, {
            left: leftPosition,
            top: workArea.top,
            width: halfWidth,
            height: fullHeight,
            state: 'normal'  // Ensure not maximized
          });
          log('Source window resized');
        }
        
        // Open AI in new window on right half
        log('Creating AI window on right half...');
        const aiWindow = await chrome.windows.create({
          url: targetUrl,
          left: rightPosition,
          top: workArea.top,
          width: halfWidth,
          height: fullHeight,
          focused: true,
          type: 'normal'
        });
        log('AI window created:', aiWindow.id);
        
      } catch (splitError) {
        log('ERROR in split logic:', splitError);
        // Fallback: normal tab
        log('Falling back to normal tab');
        chrome.tabs.create({ url: targetUrl, active: true });
      }
    } else {
      log('SplitTab DISABLED - opening normal tab');
      chrome.tabs.create({ url: targetUrl, active: true });
    }

  } catch (err) {
    log('ERROR in executeAction:', err);
    console.error("AI Quick Link Error:", err);
  }
}

// --- EVENT LISTENERS ---

chrome.commands.onCommand.addListener(async (command) => {
  log('Command received:', command);
  if (command === 'send_text_to_ai') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    log('Active tab for hotkey:', tab?.id, tab?.url);
    executeAction(tab, "hotkey", null); 
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  log('Context menu clicked:', { menuItemId: info.menuItemId, selectionText: info.selectionText?.substring(0, 50) });
  executeAction(tab, info.menuItemId, info.selectionText);
});

// --- LEFT-CLICK SUPPORT ---
chrome.action.onClicked.addListener((tab) => {
  log('Extension icon clicked');
  chrome.runtime.openOptionsPage();
});