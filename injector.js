// injector.js - Modul 12: Simplified Injector

const SELECTORS = {
  chatgpt: ['#prompt-textarea', 'div[contenteditable="true"]'],
  claude: ['div[contenteditable="true"]', '.ProseMirror'],
  gemini: ['div[contenteditable="true"]', '.ql-editor', 'textarea']
};

function simulateInput(element, text) {
  element.focus();
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    element.value = text;
  } else {
    element.innerHTML = `<p>${text}</p>`;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function injectText() {
  // NUR NOCH den finalen Text holen. Kein Prefix/Suffix Zusammenbau mehr hier!
  const localData = await chrome.storage.local.get(['pendingPrompt']);
  
  if (!localData.pendingPrompt) return;
  const finalText = localData.pendingPrompt;

  // Provider Check
  const url = window.location.href;
  let provider = null;
  if (url.includes('chatgpt.com')) provider = 'chatgpt';
  else if (url.includes('claude.ai')) provider = 'claude';
  else if (url.includes('gemini.google')) provider = 'gemini';

  let inputField = null;

  // Suche starten (Generic + Specific)
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;

    if (provider) {
      for (const selector of SELECTORS[provider]) {
        inputField = document.querySelector(selector);
        if (inputField) break;
      }
    } else {
      // Generic Search
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.offsetParent !== null && ta.clientHeight > 20) {
          inputField = ta;
          break; 
        }
      }
      if (!inputField) {
        const editables = document.querySelectorAll('div[contenteditable="true"]');
        for (const ed of editables) {
             if (ed.offsetParent !== null) {
                inputField = ed;
                break;
             }
        }
      }
    }

    if (inputField) {
      console.log("AI Quick Link: Inserting text...");
      simulateInput(inputField, finalText);
      clearInterval(interval);
      chrome.storage.local.remove('pendingPrompt');
    }

    if (attempts >= 20) clearInterval(interval);
  }, 500);
}

injectText();