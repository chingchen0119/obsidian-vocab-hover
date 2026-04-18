# Vocab Hover

An [Obsidian](https://obsidian.md) plugin that lets you add hover tooltips to any word — great for vocabulary learning, annotations, or quick references.

## Demo

Hover over a marked word to see its tooltip:

![demo](demo.gif)

## How to Use

### Adding a tooltip

1. **Select** any word or phrase in the editor
2. **Right-click** → **Add Hover Content**
3. Type the tooltip text (e.g. a translation or definition)
4. Press **Enter** or click **Confirm**

The word is saved as `{word::tooltip}` in your note.

### Viewing tooltips

Switch to **Reading View** and hover over any underlined word to see its tooltip.

### Manual syntax

You can also type the syntax directly:

```
The {diffuse::漫射} map controls the base color.
```

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community Plugins**
2. Disable Safe Mode if prompted
3. Click **Browse** and search for **Vocab Hover**
4. Click **Install** then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/chingchen0119/obsidian-vocab-hover/releases/latest)
2. Copy them into your vault at `.obsidian/plugins/vocab-hover/`
3. Enable the plugin in **Settings → Community Plugins**

## License

[MIT](LICENSE)
