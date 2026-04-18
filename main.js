const { Plugin, Modal, PluginSettingTab, Setting, TFile, Notice } = require('obsidian');

const PATTERN = /\{([^:{}]+)::([^{}]+)\}/g;

const LANG = {
  en: {
    menuItem:        'Add Hover Content',
    modalTitle:      (word) => `Hover content for "${word}"`,
    placeholder:     'Enter tooltip text...',
    confirm:         'Confirm',
    settingLang:     'Language',
    settingLangDesc: 'Language for menus and dialogs.',
    settingNote:     'Vocabulary note path',
    settingNoteDesc: 'Path of the vocabulary list note.',
    settingStyle:    'Word highlight style',
    settingStyleDesc:'Visual style for words with hover content.',
    styleOptions:    { dotted: 'Dotted underline', solid: 'Solid underline', highlight: 'Highlight', badge: 'Badge', box: 'Box' },
    settingGenerate:     'Generate Vocabulary List',
    settingGenerateDesc: 'Scan all notes and create the vocabulary list. Once created, it will update automatically on save.',
    settingGenerateBtn:  'Generate',
    noticeGenerated: 'Vocabulary list generated.',
    noticeUpdated:   'Vocabulary list updated.',
  },
  zh: {
    menuItem:        '新增 Hover 內容',
    modalTitle:      (word) => `「${word}」的 Hover 內容`,
    placeholder:     '輸入顯示文字，例如：漫射',
    confirm:         '確定',
    settingLang:     '語言',
    settingLangDesc: '選單與對話框的顯示語言。',
    settingNote:     '單字清單筆記路徑',
    settingNoteDesc: '單字清單筆記的位置。',
    settingStyle:    '單字標示樣式',
    settingStyleDesc:'有 Hover 內容的單字顯示方式。',
    styleOptions:    { dotted: '虛線底線', solid: '實線底線', highlight: '螢光底色', badge: '標籤', box: '方塊框線' },
    settingGenerate:     '產生單字清單',
    settingGenerateDesc: '掃描所有筆記並建立單字清單。建立後每次儲存時會自動更新。',
    settingGenerateBtn:  '產生',
    noticeGenerated: '單字清單已產生。',
    noticeUpdated:   '單字清單已更新。',
  },
};

const DEFAULT_SETTINGS = {
  language: 'en',
  vocabNotePath: 'Vocabulary List.md',
  wordStyle: 'dotted',
};

// ── Modal ──────────────────────────────────────────────────
class VocabModal extends Modal {
  constructor(app, word, t, onSubmit) {
    super(app);
    this.word = word; this.t = t; this.onSubmit = onSubmit;
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
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
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
          this.display();
        })
      );

    const t = LANG[plugin.settings.language];

    new Setting(containerEl)
      .setName(t.settingStyle)
      .setDesc(t.settingStyleDesc)
      .addDropdown(drop => {
        Object.entries(t.styleOptions).forEach(([val, label]) => drop.addOption(val, label));
        drop.setValue(plugin.settings.wordStyle)
          .onChange(async val => {
            plugin.settings.wordStyle = val;
            await plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t.settingNote)
      .setDesc(t.settingNoteDesc)
      .addText(text => text
        .setValue(plugin.settings.vocabNotePath)
        .onChange(async val => {
          plugin.settings.vocabNotePath = val.trim() || 'Vocabulary List.md';
          await plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t.settingGenerate)
      .setDesc(t.settingGenerateDesc)
      .addButton(btn => btn
        .setButtonText(t.settingGenerateBtn)
        .setCta()
        .onClick(async () => {
          await plugin.updateVocabNote();
          new Notice(t.noticeGenerated);
        })
      );
  }
}

// ── Plugin ─────────────────────────────────────────────────
module.exports = class VocabHoverPlugin extends Plugin {

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new VocabSettingTab(this.app, this));
    this._debounceTimer = null;

    // 右鍵選單
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const sel = editor.getSelection().trim();
        if (!sel) return;
        const t = LANG[this.settings.language];
        menu.addItem(item =>
          item.setTitle(t.menuItem).setIcon('message-square')
            .onClick(() => {
              new VocabModal(this.app, sel, t, translation => {
                editor.replaceSelection(`{${sel}::${translation}}`);
              }).open();
            })
        );
      })
    );

    // 閱讀模式渲染（延遲執行，確保在其他 post-processor 之後跑）
    this.registerMarkdownPostProcessor(el => setTimeout(() => this.render(el), 0));

    // 監聽檔案變更 → 只有在單字清單已存在時才自動更新
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file.path === this.settings.vocabNotePath) return;
        const existing = this.app.vault.getAbstractFileByPath(this.settings.vocabNotePath);
        if (existing instanceof TFile) this.scheduleUpdate();
      })
    );
    this.registerEvent(
      this.app.vault.on('delete', () => {
        const existing = this.app.vault.getAbstractFileByPath(this.settings.vocabNotePath);
        if (existing instanceof TFile) this.scheduleUpdate();
      })
    );
  }

  scheduleUpdate() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this.updateVocabNote(), 2000);
  }

  async updateVocabNote() {
    const { vault } = this.app;
    const vocabPath = this.settings.vocabNotePath;

    const entries = [];
    const files = vault.getMarkdownFiles().filter(f => f.path !== vocabPath);

    for (const file of files) {
      const content = await vault.read(file);
      PATTERN.lastIndex = 0;
      let m;
      while ((m = PATTERN.exec(content)) !== null) {
        entries.push({
          word:        m[1].trim(),
          translation: m[2].trim(),
          source:      file.path,
        });
      }
    }

    // 依來源分組，組內按單字排序
    const groups = {};
    for (const e of entries) {
      if (!groups[e.source]) groups[e.source] = [];
      groups[e.source].push(e);
    }
    for (const src of Object.keys(groups)) {
      groups[src].sort((a, b) => a.word.localeCompare(b.word));
    }

    const now = new Date().toISOString().slice(0, 10);
    let md = `*Last updated: ${now}*\n\n`;
    md += `| Word | Translation | Source |\n`;
    md += `|---|---|---|\n`;

    for (const src of Object.keys(groups).sort()) {
      for (const e of groups[src]) {
        const link = `[[${src.replace(/\.md$/, '')}]]`;
        md += `| ${e.word} | ${e.translation} | ${link} |\n`;
      }
    }

    const existing = vault.getAbstractFileByPath(vocabPath);
    if (existing instanceof TFile) {
      await vault.modify(existing, md);
    } else {
      await vault.create(vocabPath, md);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() { await this.saveData(this.settings); }

  render(el) {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walk.nextNode())) {
      if (n.parentElement?.closest('code, pre')) continue;
      PATTERN.lastIndex = 0;
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
        span.className = `vocab-hover vocab-style-${this.settings.wordStyle}`;
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
