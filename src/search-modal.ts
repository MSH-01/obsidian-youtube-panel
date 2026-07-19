import { App, Keymap, SuggestModal } from "obsidian";
import type YouTubePanelPlugin from "./main";
import { SearchResult, searchYouTube } from "./utils";

export class YouTubeSearchModal extends SuggestModal<SearchResult> {
	private plugin: YouTubePanelPlugin;

	constructor(app: App, plugin: YouTubePanelPlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder("Search YouTube…");
		this.limit = 20;
		this.setInstructions([
			{ command: "↵", purpose: "add to queue" },
			{ command: "⌘ ↵", purpose: "play now" },
		]);
		this.scope.register(["Mod"], "Enter", (evt) => {
			// Undocumented API: forward mod+enter to the selected item
			const chooser = (
				this as unknown as {
					chooser?: { useSelectedItem?: (evt: KeyboardEvent) => void };
				}
			).chooser;
			chooser?.useSelectedItem?.(evt);
			return false;
		});
	}

	async getSuggestions(query: string): Promise<SearchResult[]> {
		const q = query.trim();
		if (q.length < 2) return [];
		// Debounce: wait, then bail if the input has changed since
		await new Promise((resolve) => window.setTimeout(resolve, 350));
		if (this.inputEl.value.trim() !== q) return [];
		try {
			return await searchYouTube(q);
		} catch {
			return [];
		}
	}

	renderSuggestion(item: SearchResult, el: HTMLElement) {
		el.addClass("ytp-search-suggestion");
		el.createDiv({ cls: "ytp-search-title", text: item.title });
		const meta = [item.channel, item.duration || "live"]
			.filter(Boolean)
			.join(" · ");
		el.createDiv({ cls: "ytp-search-meta", text: meta });
	}

	onChooseSuggestion(item: SearchResult, evt: MouseEvent | KeyboardEvent) {
		const url = `https://www.youtube.com/watch?v=${item.videoId}`;
		if (Keymap.isModEvent(evt)) {
			void this.plugin.playUrl(url);
		} else {
			void this.plugin.addToQueue(url, item.title);
		}
	}
}
