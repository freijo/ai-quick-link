// options.js - Modul 12: Quick Prompts & Refactoring

const DEFAULT_PROVIDERS = [
  { key: 'chatgpt', name: 'ChatGPT (OpenAI)', url: 'https://chatgpt.com/' },
  { key: 'claude', name: 'Claude (Anthropic)', url: 'https://claude.ai/new' },
  { key: 'gemini', name: 'Gemini (Google)', url: 'https://gemini.google.com/' }
];

const localizeHtml = () => {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const msg = chrome.i18n.getMessage(key);
    if (msg) element.textContent = msg;
  });
  // Placeholders
  document.getElementById('newProviderName').placeholder = chrome.i18n.getMessage('phName');
  document.getElementById('newProviderUrl').placeholder = chrome.i18n.getMessage('phUrl');
  document.getElementById('customPrefix').placeholder = chrome.i18n.getMessage('phPrefix');
  document.getElementById('customSuffix').placeholder = chrome.i18n.getMessage('phSuffix');
  document.getElementById('quickName').placeholder = chrome.i18n.getMessage('lblQuickName');
  document.getElementById('quickPrefix').placeholder = chrome.i18n.getMessage('lblQuickPrefix');
  document.getElementById('quickSuffix').placeholder = chrome.i18n.getMessage('lblQuickSuffix');
};

// --- RENDER FUNCTIONS ---

const renderDropdown = (customList, selectedKey) => {
  const select = document.getElementById('provider');
  select.innerHTML = '';
  DEFAULT_PROVIDERS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.key;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  if (customList && customList.length > 0) {
    const divider = document.createElement('option');
    divider.disabled = true;
    divider.textContent = '──────────';
    select.appendChild(divider);
    customList.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = `${p.name} ✏️`;
      select.appendChild(opt);
    });
  }
  select.value = selectedKey || 'chatgpt';
};

const renderCustomList = (list) => {
  const container = document.getElementById('customList');
  container.innerHTML = '';
  (list || []).forEach((p, index) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span class="list-info"><b>${p.name}</b><br>${p.url}</span> <button class="btn-delete" data-type="provider" data-index="${index}">🗑️</button>`;
    container.appendChild(div);
  });
};

const renderQuickPrompts = (list) => {
  const container = document.getElementById('quickPromptList');
  container.innerHTML = '';
  (list || []).forEach((p, index) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `<span class="list-info"><b>${p.name}</b><br><span style="color:#666">Pre: ${p.prefix.substring(0,20)}...</span></span> <button class="btn-delete" data-type="prompt" data-index="${index}">🗑️</button>`;
    container.appendChild(div);
  });
  
  // Delete Handler für beide Listen
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.dataset.index;
      const type = e.target.dataset.type;
      deleteItem(type, idx);
    });
  });
};

// --- LOGIC ---

const deleteItem = (type, index) => {
  chrome.storage.sync.get({ customProviders: [], quickPrompts: [] }, (items) => {
    if (type === 'provider') {
      items.customProviders.splice(index, 1);
      chrome.storage.sync.set({ customProviders: items.customProviders }, restoreOptions);
    } else {
      items.quickPrompts.splice(index, 1);
      chrome.storage.sync.set({ quickPrompts: items.quickPrompts }, restoreOptions);
    }
  });
};

const addCustomProvider = () => {
  const name = document.getElementById('newProviderName').value.trim();
  let url = document.getElementById('newProviderUrl').value.trim();
  if (!name || !url) return;
  if (!url.startsWith('http')) url = 'https://' + url;

  chrome.storage.sync.get({ customProviders: [] }, (items) => {
    const list = items.customProviders || [];
    list.push({ key: `cust_${Date.now()}`, name, url });
    chrome.storage.sync.set({ customProviders: list }, () => {
      document.getElementById('newProviderName').value = '';
      document.getElementById('newProviderUrl').value = '';
      restoreOptions();
    });
  });
};

const addQuickPrompt = () => {
  const name = document.getElementById('quickName').value.trim();
  const prefix = document.getElementById('quickPrefix').value;
  const suffix = document.getElementById('quickSuffix').value;
  if (!name) return;

  chrome.storage.sync.get({ quickPrompts: [] }, (items) => {
    const list = items.quickPrompts || [];
    list.push({ id: `prompt_${Date.now()}`, name, prefix, suffix });
    chrome.storage.sync.set({ quickPrompts: list }, () => {
      document.getElementById('quickName').value = '';
      document.getElementById('quickPrefix').value = '';
      document.getElementById('quickSuffix').value = '';
      restoreOptions();
    });
  });
};

const saveOptions = () => {
  const provider = document.getElementById('provider').value;
  const prefix = document.getElementById('customPrefix').value;
  const suffix = document.getElementById('customSuffix').value;
  
  chrome.storage.sync.set({ selectedProvider: provider, customPrefix: prefix, customSuffix: suffix }, () => {
    const status = document.getElementById('status');
    status.textContent = chrome.i18n.getMessage("statusSaved");
    status.style.opacity = '1';
    setTimeout(() => { status.style.opacity = '0'; }, 1500);
  });
};

const restoreOptions = () => {
  localizeHtml();
  chrome.storage.sync.get({
    selectedProvider: 'chatgpt', customPrefix: '', customSuffix: '', customProviders: [], quickPrompts: []
  }, (items) => {
    renderDropdown(items.customProviders, items.selectedProvider);
    renderCustomList(items.customProviders);
    renderQuickPrompts(items.quickPrompts);
    document.getElementById('customPrefix').value = items.customPrefix;
    document.getElementById('customSuffix').value = items.customSuffix;
    
    chrome.commands.getAll((cmds) => {
      const c = cmds.find(x => x.name === 'send_text_to_ai');
      document.getElementById('currentShortcut').value = c ? c.shortcut : '';
    });
  });
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('provider').addEventListener('change', saveOptions);
document.getElementById('customPrefix').addEventListener('input', saveOptions);
document.getElementById('customSuffix').addEventListener('input', saveOptions);
document.getElementById('addProvider').addEventListener('click', addCustomProvider);
document.getElementById('addQuickPrompt').addEventListener('click', addQuickPrompt);
document.getElementById('changeShortcut').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));