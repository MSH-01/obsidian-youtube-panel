import { Editor, Menu, Notice, Plugin } from "obsidian";
import { YouTubeView, YOUTUBE_PANEL_VIEW } from "./view";
import { findYouTubeUrlInText } from "./utils";

export interface YouTubePanelSettings {
	lastUrl: string;
}

const DEFAULT_SETTINGS: YouTubePanelSettings = {
	lastUrl: "",
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
			id: "open-youtube-panel",
			name: "Open YouTube player",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "play-selection",
			name: "Play YouTube link from selection or current line",
			editorCallback: (editor: Editor) => {
				const text =
					editor.getSelection() ||
					editor.getLine(editor.getCursor().line);
				const url = findYouTubeUrlInText(text);
				if (!url) {
					new Notice("No YouTube link found in selection");
					return;
				}
				void this.playUrl(url);
			},
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

		// Right-click a YouTube link in the editor → "Play in side panel"
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
			}),
		);
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(YOUTUBE_PANEL_VIEW);
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
