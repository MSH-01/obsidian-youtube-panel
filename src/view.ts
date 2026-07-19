import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import type YouTubePanelPlugin from "./main";
import { buildEmbedUrl, parseYouTubeUrl } from "./utils";

export const YOUTUBE_PANEL_VIEW = "youtube-panel-view";

export class YouTubeView extends ItemView {
	plugin: YouTubePanelPlugin;
	private urlInput: HTMLInputElement | null = null;
	private playerWrap: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: YouTubePanelPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return YOUTUBE_PANEL_VIEW;
	}

	getDisplayText(): string {
		return "YouTube player";
	}

	getIcon(): string {
		return "play-circle";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("ytp-container");

		const bar = container.createDiv({ cls: "ytp-bar" });
		this.urlInput = bar.createEl("input", {
			cls: "ytp-input",
			attr: {
				type: "text",
				placeholder: "Paste a YouTube URL and press Enter…",
				spellcheck: "false",
			},
		});
		this.urlInput.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" && this.urlInput) {
				this.loadUrl(this.urlInput.value);
			}
		});

		const goBtn = bar.createEl("button", { cls: "ytp-go", text: "Play" });
		goBtn.addEventListener("click", () => {
			if (this.urlInput) this.loadUrl(this.urlInput.value);
		});

		this.playerWrap = container.createDiv({ cls: "ytp-player" });

		const lastUrl = this.plugin.settings.lastUrl;
		if (lastUrl) {
			this.urlInput.value = lastUrl;
			this.loadUrl(lastUrl, false);
		} else {
			this.showEmptyState();
		}
	}

	async onClose() {
		this.contentEl.empty();
	}

	private showEmptyState() {
		if (!this.playerWrap) return;
		this.playerWrap.empty();
		this.playerWrap.createDiv({
			cls: "ytp-empty",
			text: "No video loaded. Paste a YouTube link above.",
		});
	}

	/** Load a URL (or bare video id) into the embedded player */
	loadUrl(input: string, autoplay = true) {
		const parsed = parseYouTubeUrl(input);
		if (!parsed) {
			new Notice("Not a recognizable YouTube URL");
			return;
		}

		const src = new URL(buildEmbedUrl(parsed));
		if (!autoplay) src.searchParams.set("autoplay", "0");

		if (this.urlInput) this.urlInput.value = input.trim();
		if (this.playerWrap) {
			this.playerWrap.empty();
			this.playerWrap.createEl("iframe", {
				cls: "ytp-iframe",
				attr: {
					src: src.toString(),
					frameborder: "0",
					allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
					allowfullscreen: "true",
				},
			});
		}

		this.plugin.settings.lastUrl = input.trim();
		void this.plugin.saveSettings();
	}
}
