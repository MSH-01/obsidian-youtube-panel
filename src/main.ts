import { Editor, Menu, Notice, Plugin } from "obsidian";
import { YouTubeView, YOUTUBE_PANEL_VIEW } from "./view";
import { YouTubeSearchModal } from "./search-modal";
import {
	fetchVideoTitle,
	findYouTubeUrlInText,
	parseYouTubeUrl,
	QueueItem,
} from "./utils";

export interface YouTubePanelSettings {
	lastUrl: string;
	queue: QueueItem[];
}

const DEFAULT_SETTINGS: YouTubePanelSettings = {
	lastUrl: "",
	queue: [],
};

export default class YouTubePanelPlugin extends Plugin {
	settings: YouTubePanelSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(
			YOUTUBE_PANEL_VIEW,
			(leaf) => new YouTubeView(leaf, this),
		);

		this.addRibbonIcon("play-circle", "Open YouTube player", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-player",
			name: "Open YouTube player",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "play-selection",
			name: "Play YouTube link from selection or current line",
			editorCallback: (editor: Editor) => {
				const url = this.linkFromEditor(editor);
				if (!url) {
					new Notice("No YouTube link found in selection");
					return;
				}
				void this.playUrl(url);
			},
		});

		this.addCommand({
			id: "queue-selection",
			name: "Add YouTube link from selection or current line to queue",
			editorCallback: (editor: Editor) => {
				const url = this.linkFromEditor(editor);
				if (!url) {
					new Notice("No YouTube link found in selection");
					return;
				}
				void this.addToQueue(url);
			},
		});

		this.addCommand({
			id: "search-youtube",
			name: "Search YouTube",
			callback: () => new YouTubeSearchModal(this.app, this).open(),
		});

		this.addCommand({
			id: "play-clipboard",
			name: "Play YouTube link from clipboard",
			callback: async () => {
				const text = await navigator.clipboard.readText();
				const url = findYouTubeUrlInText(text ?? "");
				if (!url) {
					new Notice("No YouTube link found in clipboard");
					return;
				}
				void this.playUrl(url);
			},
		});

		// Right-click a YouTube link in the editor → play / queue
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
				const line = editor.getLine(editor.getCursor().line);
				const url = findYouTubeUrlInText(line);
				if (!url) return;
				menu.addItem((item) => {
					item.setTitle("Play in side panel")
						.setIcon("play-circle")
						.onClick(() => void this.playUrl(url));
				});
				menu.addItem((item) => {
					item.setTitle("Add to YouTube queue")
						.setIcon("list-plus")
						.onClick(() => void this.addToQueue(url));
				});
			}),
		);
	}

	private linkFromEditor(editor: Editor): string | null {
		const text =
			editor.getSelection() || editor.getLine(editor.getCursor().line);
		return findYouTubeUrlInText(text);
	}

	/** Open (or reveal) the view in the right sidebar and return it */
	async activateView(): Promise<YouTubeView | null> {
		const existing = this.app.workspace.getLeavesOfType(YOUTUBE_PANEL_VIEW);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]);
			const view = existing[0].view;
			return view instanceof YouTubeView ? view : null;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return null;
		await leaf.setViewState({ type: YOUTUBE_PANEL_VIEW, active: true });
		await this.app.workspace.revealLeaf(leaf);
		const view = leaf.view;
		return view instanceof YouTubeView ? view : null;
	}

	async playUrl(url: string) {
		const view = await this.activateView();
		view?.loadUrl(url);
	}

	/** Append a video to the queue, resolving its title in the background if unknown */
	async addToQueue(input: string, knownTitle?: string) {
		const url = input.trim();
		if (!parseYouTubeUrl(url)) {
			new Notice("Not a recognizable YouTube URL");
			return;
		}
		const item: QueueItem = { url, title: knownTitle ?? url };
		this.settings.queue.push(item);
		await this.saveSettings();
		this.refreshQueueViews();
		new Notice("Added to queue");

		if (!knownTitle) {
			const title = await fetchVideoTitle(url);
			if (title) {
				item.title = title;
				await this.saveSettings();
				this.refreshQueueViews();
			}
		}
	}

	private refreshQueueViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(YOUTUBE_PANEL_VIEW)) {
			if (leaf.view instanceof YouTubeView) leaf.view.refreshQueue();
		}
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<YouTubePanelSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		if (!Array.isArray(this.settings.queue)) this.settings.queue = [];
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
