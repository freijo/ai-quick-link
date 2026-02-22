// background.js - Modul 13.1: iFrame Focus Fix

const DEFAULT_URLS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/"
};

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
  if (!tab || tab.url.startsWith("chrome://")) return;

  try {
    let textToProcess = "";

    // 1. Wenn Rechtsklick -> Nimm den Text direkt (Sicherste Methode)
    if (directTextFromMenu) {
      textToProcess = directTextFromMenu.trim();
    } 
    
    // 2. Wenn Hotkey (Alt+A) -> Suche den FOKUSSIERTEN Frame
    if (!textToProcess) {
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          return {
            text: window.getSelection().toString(),
            isFocused: document.hasFocus() // WICHTIG: Hat dieser Frame den Fokus?
          };
        }
      });

      if (results && results.length > 0) {
        // A. Suche zuerst den Frame, der Fokus UND Text hat (Der Gewinner)
        const focusedFrame = results.find(r => r.result && r.result.isFocused && r.result.text.trim().length > 0);
        
        if (focusedFrame) {
           textToProcess = focusedFrame.result.text.trim();
        } else {
           // B. Fallback: Falls kein Fokus erkannt wurde, nimm den ersten mit Text,
           // aber ignoriere Frames, die nur HTML-Tags als Text liefern (einfacher Filter)
           const anyFrame = results.find(r => {
             const t = (r.result && r.result.text) ? r.result.text.trim() : "";
             // Ignoriere, wenn der Text mit "<iframe" beginnt und mit ">" endet
             const looksLikeTag = t.startsWith("<iframe") && t.endsWith(">");
             return t.length > 0 && !looksLikeTag;
           });

           if (anyFrame) textToProcess = anyFrame.result.text.trim();
        }
      }
    }

    if (!textToProcess) {
      console.warn("Kein gültiger Text gefunden.");
      return;
    }

    // --- Ab hier Standard-Ablauf ---

    const data = await chrome.storage.sync.get({
      selectedProvider: 'chatgpt',
      customProviders: [],
      customPrefix: '',
      customSuffix: '',
      quickPrompts: []
    });

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

    chrome.tabs.create({ url: targetUrl, active: true });

  } catch (err) {
    console.error("AI Quick Link Error:", err);
  }
}

// --- EVENT LISTENERS ---

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'send_text_to_ai') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    executeAction(tab, "hotkey", null); 
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  executeAction(tab, info.menuItemId, info.selectionText);
});

// --- LEFT-CLICK SUPPORT (NEW) ---
// Open options when user left-clicks the plugin icon
chrome.action.onClicked.addListener((tab) => {
  chrome.runtime.openOptionsPage();
});