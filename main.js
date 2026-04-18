const { Plugin, Modal, PluginSettingTab, Setting } = require('obsidian');

const PATTERN = /\{([^:{}]+)::([^{}]+)\}/g;

const LANG = {
  en: {
    menuItem:    'Add Hover Content',
    modalTitle:  (word) => `Hover content for "${word}"`,
    placeholder: 'Enter tooltip text...',
    confirm:     'Confirm',
    settingLang: 'Language',
    settingDesc: 'Language for menus and dialogs.',
  },
  zh: {
    menuItem:    '新增 Hover 內容',
    modalTitle:  (word) => `「${word}」的 Hover 內容`,
    placeholder: '輸入顯示文字，例如：漫射',
    confirm:     '確定',
    settingLang: '語言',
    settingDesc: '選單與對話框的顯示語言。',
  },
};

const DEFAULT_SETTINGS = { language: 'en' };

// ── Modal ──────────────────────────────────────────────────
class VocabModal extends Modal {
  constructor(app, word, t, onSubmit) {
    super(app);
    this.word = word;
    this.t = t;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl, t, word } = this;
    contentEl.empty();
    contentEl.createEl('h3', { text: t.modalTitle(word) });

    const input = contentEl.createEl('input', { type: 'text' });
    input.placeholder = t.placeholder;
    input.style.cssText = 'width:100%; padding:6px 8px; margin:8px 0 14px; font-size:1em;';
    input.focus();

    const btn = contentEl.createEl('button', { text: t.confirm });
    btn.style.cssText = 'padding:4px 16px;';

    const submit = () => {
      const val = input.value.trim();
      if (val) { this.onSubmit(val); this.close(); }
    };
    btn.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }

  onClose() { this.contentEl.empty(); }
}

// ── Settings Tab ───────────────────────────────────────────
class VocabSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl, plugin } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Language / 語言')
      .setDesc('Menu and dialog language.')
      .addDropdown(drop => drop
        .addOption('en', 'English')
        .addOption('zh', '中文')
        .setValue(plugin.settings.language)
        .onChange(async val => {
          plugin.settings.language = val;
          await plugin.saveSettings();
        })
      );
  }
}

// ── Plugin ─────────────────────────────────────────────────
module.exports = class VocabHoverPlugin extends Plugin {

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VocabSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const sel = editor.getSelection().trim();
        if (!sel) return;
        const t = LANG[this.settings.language];

        menu.addItem(item =>
          item
            .setTitle(t.menuItem)
            .setIcon('message-square')
            .onClick(() => {
              new VocabModal(this.app, sel, t, translation => {
                editor.replaceSelection(`{${sel}::${translation}}`);
              }).open();
            })
        );
      })
    );

    this.registerMarkdownPostProcessor(el => this.render(el));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  render(el) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walk.nextNode())) {
      if (n.parentElement?.closest('code, pre')) continue;
      if (PATTERN.test(n.textContent)) nodes.push(n);
    }

    for (const textNode of nodes) {
      PATTERN.lastIndex = 0;
      const text = textNode.textContent;
      const frag = document.createDocumentFragment();
      let last = 0, m;

      while ((m = PATTERN.exec(text)) !== null) {
        if (m.index > last)
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));

        const span = document.createElement('span');
        span.className = 'vocab-hover';
        span.dataset.tooltip = m[2].trim();
        span.textContent = m[1].trim();
        frag.appendChild(span);
        last = m.index + m[0].length;
      }

      if (last < text.length)
        frag.appendChild(document.createTextNode(text.slice(last)));

      textNode.parentNode.replaceChild(frag, textNode);
    }
  }
};
