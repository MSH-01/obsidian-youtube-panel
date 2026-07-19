# YouTube Panel

Watch YouTube videos in Obsidian's right sidebar while you take notes — with a queue and built-in search.

## Features

### Player
- Custom view in the right sidebar with a compact **16:9 player** (privacy-enhanced `youtube-nocookie.com` embed).
- URL bar pinned to the bottom of the panel — paste a link and press Enter (or hit **Play**).
- Handles `watch?v=`, `youtu.be/`, `shorts/`, `live/`, `embed/`, playlists (`list=`), timestamps (`t=90`, `t=1h2m3s`), and bare 11-character video ids.
- Remembers the last video — reopening the panel restores it (paused).

### Queue
- Sits between the player and the URL bar; persists across restarts (stored in the plugin's `data.json`).
- **Auto-advance**: when a video ends, the next queued item plays automatically (via the YouTube iframe API's state messages).
- Items show real video titles, resolved through YouTube's oEmbed endpoint — no API key needed.
- Click an item to play it (the playing item is highlighted), hover for a remove button, **Clear** empties the queue.
- Add to the queue via:
  - the **+ Queue** button next to the URL bar
  - right-clicking a line with a YouTube link in a note → **Add to YouTube queue**
  - the command *Add YouTube link from selection or current line to queue*
  - search (below)

### Search
- The **🔍 button** in the bottom bar or the **"Search YouTube"** command opens a native search modal.
- Results show title, channel, and duration ("live" for streams).
- **Enter** adds the selection to the queue; **⌘ Enter** plays it immediately.
- No API key: it fetches the regular YouTube results page with Obsidian's `requestUrl` and parses the embedded `ytInitialData` JSON. The parser walks the JSON generically looking for `videoRenderer` objects, so it tolerates layout changes — but if YouTube restructures the page, search is the first thing that could break.

## Commands

| Command | Action |
| --- | --- |
| Open YouTube player | Open/reveal the panel (also on the ribbon) |
| Search YouTube | Open the search modal |
| Play YouTube link from selection or current line | Play the link under your cursor |
| Add YouTube link from selection or current line to queue | Queue the link under your cursor |
| Play YouTube link from clipboard | Play whatever YouTube link you copied |

## Development

```sh
npm install
npm run dev    # watch mode
npm run build  # one-off build
```

## Install into a vault

Copy (or symlink) the plugin folder into:

```
<vault>/.obsidian/plugins/obsidian-youtube-panel/
```

The vault needs `manifest.json`, `main.js`, and `styles.css`. Then enable **YouTube Panel** in Settings → Community plugins.

## Network use

This plugin does not collect or transmit any user data, and has no telemetry. It connects to the network only to talk to YouTube (Google), and only when you play, queue, or search for a video:

- **`youtube-nocookie.com`** — the embedded player itself. Videos stream directly from YouTube's privacy-enhanced embed domain, which does not set tracking cookies. Google's [privacy policy](https://policies.google.com/privacy) applies to playback.
- **`youtube.com/oembed`** — fetched once per queued video to resolve its title.
- **`youtube.com/results`** — fetched when you type in the search modal, to list matching videos.

Nothing else is contacted, and nothing from your vault is ever sent — only the video URLs/ids and search terms you explicitly enter.

## Notes

- Desktop only (`isDesktopOnly: true`).
- Some videos disable embedding ("Watch on YouTube") — that's a per-video publisher setting the plugin can't bypass.
- Playing a video that isn't in the queue doesn't insert it; when it ends, the queue starts from its first item.
