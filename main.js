const { Plugin, Modal } = require('obsidian');

const PATTERN = /\{([^:{}]+)::([^{}]+)\}/g;

// ── Tooltip Modal ──────────────────────────────────────────
class VocabModal extends Modal {
  constructor(app, word, onSubmit) {
    super(app);
    this.word = word;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h3', { text: `「${this.word}」的 Hover 內容` });

    const input = contentEl.createEl('input', { type: 'text' });
    input.placeholder = '輸入顯示文字，例如：漫射';
    input.style.cssText = 'width:100%; padding:6px 8px; margin:8px 0 14px; font-size:1em;';
    input.focus();

    const btn = contentEl.createEl('button', { text: '確定' });
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

// ── Plugin ─────────────────────────────────────────────────
module.exports = class VocabHoverPlugin extends Plugin {

  async onload() {
    // 右鍵選單
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const sel = editor.getSelection().trim();
        if (!sel) return;

        menu.addItem(item =>
          item
            .setTitle('新增 Hover 內容')
            .setIcon('message-square')
            .onClick(() => {
              new VocabModal(this.app, sel, translation => {
                editor.replaceSelection(`{${sel}::${translation}}`);
              }).open();
            })
        );
      })
    );

    // 閱讀模式渲染
    this.registerMarkdownPostProcessor(el => this.render(el));
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
