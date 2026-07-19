# YouTube Panel

Watch YouTube videos in Obsidian's right sidebar while you take notes.

## Features

- **Side panel player** — a custom view in the right sidebar with a URL bar and an embedded player (privacy-enhanced `youtube-nocookie.com` embed).
- **Ribbon icon + command** — "Open YouTube player".
- **Play from note** — command *Play YouTube link from selection or current line*, or right-click a line containing a YouTube link → **Play in side panel**.
- **Play from clipboard** — command *Play YouTube link from clipboard*.
- **URL smarts** — handles `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/`, playlists (`list=`), timestamps (`t=90`, `t=1h2m3s`), and bare 11-character video ids.
- **Remembers the last video** — reopening the panel restores it (paused).

## Development

```sh
npm install
npm run dev    # watch mode
npm run build  # one-off build
```

## Install into a vault

Copy (or symlink) `manifest.json`, `main.js`, and `styles.css` into:

```
<vault>/.obsidian/plugins/obsidian-youtube-panel/
```

Then enable **YouTube Panel** in Settings → Community plugins.
