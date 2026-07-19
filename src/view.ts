import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type YouTubePanelPlugin from "./main";
import { buildEmbedUrl, parseYouTubeUrl } from "./utils";
import { YouTubeSearchModal } from "./search-modal";

export const YOUTUBE_PANEL_VIEW = "youtube-panel-view";

export class YouTubeView extends ItemView {
	plugin: YouTubePanelPlugin;
	private urlInput: HTMLInputElement | null = null;
	private playerWrap: HTMLElement | null = null;
	private queueListEl: HTMLElement | null = null;
	private queueCountEl: HTMLElement | null = null;
	private currentUrl = "";
	private lastPlayerState = -1;

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

		// Player (fixed 16:9, not full height)
		this.playerWrap = container.createDiv({ cls: "ytp-player" });

		// Queue
		const queueWrap = container.createDiv({ cls: "ytp-queue" });
		const header = queueWrap.createDiv({ cls: "ytp-queue-header" });
		header.createSpan({ cls: "ytp-queue-title", text: "Queue" });
		this.queueCountEl = header.createSpan({ cls: "ytp-queue-count" });
		const clearBtn = header.createEl("button", {
			cls: "ytp-queue-clear",
			text: "Clear",
		});
		clearBtn.addEventListener("click", () => {
			this.plugin.settings.queue = [];
			void this.plugin.saveSettings();
			this.renderQueue();
		});
		this.queueListEl = queueWrap.createDiv({ cls: "ytp-queue-list" });
		this.renderQueue();

		// URL bar, pinned to the bottom of the panel
		const bar = container.createDiv({ cls: "ytp-bar" });
		this.urlInput = bar.createEl("input", {
			cls: "ytp-input",
			attr: {
				type: "text",
				placeholder: "Paste a YouTube URL…",
				spellcheck: "false",
			},
		});
		this.urlInput.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter" && this.urlInput) {
				this.loadUrl(this.urlInput.value);
			}
		});

		const playBtn = bar.createEl("button", { cls: "ytp-go", text: "Play" });
		playBtn.addEventListener("click", () => {
			if (this.urlInput) this.loadUrl(this.urlInput.value);
		});

		const queueBtn = bar.createEl("button", {
			cls: "ytp-go",
			text: "+ Queue",
			attr: { "aria-label": "Add to queue" },
		});
		queueBtn.addEventListener("click", () => {
			if (this.urlInput) {
				void this.addToQueue(this.urlInput.value);
				this.urlInput.value = "";
			}
		});

		const searchBtn = bar.createEl("button", {
			cls: "ytp-go ytp-icon-btn",
			attr: { "aria-label": "Search YouTube" },
		});
		setIcon(searchBtn, "search");
		searchBtn.addEventListener("click", () => {
			new YouTubeSearchModal(this.app, this.plugin).open();
		});

		// Listen for player state messages from the YouTube iframe
		// (used to auto-advance the queue when a video ends)
		this.registerDomEvent(window, "message", (evt: MessageEvent) => {
			this.onPlayerMessage(evt);
		});

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
			text: "No video loaded",
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
		src.searchParams.set("enablejsapi", "1");
		if (!autoplay) src.searchParams.set("autoplay", "0");

		this.currentUrl = input.trim();
		this.lastPlayerState = -1;
		if (this.urlInput) this.urlInput.value = this.currentUrl;

		if (this.playerWrap) {
			this.playerWrap.empty();
			const iframe = this.playerWrap.createEl("iframe", {
				cls: "ytp-iframe",
				attr: {
					src: src.toString(),
					frameborder: "0",
					allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
					allowfullscreen: "true",
				},
			});
			// Ask the player to start posting state updates to us
			iframe.addEventListener("load", () => {
				iframe.contentWindow?.postMessage(
					JSON.stringify({ event: "listening", id: "ytp", channel: "widget" }),
					"*",
				);
			});
		}

		this.plugin.settings.lastUrl = this.currentUrl;
		void this.plugin.saveSettings();
		this.renderQueue();
	}

	async addToQueue(input: string) {
		await this.plugin.addToQueue(input);
	}

	/** Re-render the queue list (called by the plugin after queue changes) */
	refreshQueue() {
		this.renderQueue();
	}

	private renderQueue() {
		if (!this.queueListEl || !this.queueCountEl) return;
		const queue = this.plugin.settings.queue;
		this.queueCountEl.setText(queue.length ? `${queue.length}` : "");
		this.queueListEl.empty();

		if (queue.length === 0) {
			this.queueListEl.createDiv({
				cls: "ytp-queue-empty",
				text: "Queue is empty",
			});
			return;
		}

		queue.forEach((item, i) => {
			const row = this.queueListEl!.createDiv({ cls: "ytp-queue-item" });
			if (item.url === this.currentUrl) row.addClass("is-playing");

			row.createSpan({ cls: "ytp-queue-index", text: `${i + 1}` });
			row.createSpan({ cls: "ytp-queue-item-title", text: item.title });

			const removeBtn = row.createEl("button", {
				cls: "ytp-queue-remove",
				attr: { "aria-label": "Remove from queue" },
			});
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", (evt) => {
				evt.stopPropagation();
				this.plugin.settings.queue.splice(i, 1);
				void this.plugin.saveSettings();
				this.renderQueue();
			});

			row.addEventListener("click", () => this.loadUrl(item.url));
		});
	}

	/** Play the queue item after the currently playing one (or the first) */
	private playNext() {
		const queue = this.plugin.settings.queue;
		if (queue.length === 0) return;
		const idx = queue.findIndex((item) => item.url === this.currentUrl);
		const next = queue[idx + 1] ?? (idx === -1 ? queue[0] : undefined);
		if (next) this.loadUrl(next.url);
	}

	private onPlayerMessage(evt: MessageEvent) {
		if (
			typeof evt.origin !== "string" ||
			!/https:\/\/(www\.)?(youtube|youtube-nocookie)\.com$/.test(evt.origin)
		) {
			return;
		}
		if (typeof evt.data !== "string") return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(evt.data);
		} catch {
			return;
		}
		if (!parsed || typeof parsed !== "object") return;
		const data = parsed as { event?: unknown; info?: unknown };

		let state: number | undefined;
		if (data.event === "onStateChange" && typeof data.info === "number") {
			state = data.info;
		} else if (
			data.event === "infoDelivery" &&
			data.info &&
			typeof data.info === "object"
		) {
			const playerState = (data.info as { playerState?: unknown }).playerState;
			if (typeof playerState === "number") state = playerState;
		}
		if (state === undefined) return;

		// 0 = ended; only advance on the transition into "ended"
		if (state === 0 && this.lastPlayerState !== 0) {
			this.lastPlayerState = state;
			this.playNext();
			return;
		}
		this.lastPlayerState = state;
	}
}
