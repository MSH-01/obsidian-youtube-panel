import { requestUrl } from "obsidian";

export interface QueueItem {
	url: string;
	title: string;
}

export interface ParsedYouTube {
	videoId: string | null;
	playlistId: string | null;
	/** Start time in seconds */
	start: number;
}

const VIDEO_ID_RE = /^[\w-]{11}$/;

/** Parse "1h2m30s", "2m30s", "90s" or plain "90" into seconds */
function parseTimestamp(raw: string): number {
	if (/^\d+$/.test(raw)) return parseInt(raw, 10);
	const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
	if (!match) return 0;
	const [, h, m, s] = match;
	return (
		(h ? parseInt(h, 10) * 3600 : 0) +
		(m ? parseInt(m, 10) * 60 : 0) +
		(s ? parseInt(s, 10) : 0)
	);
}

/**
 * Extract a video/playlist id from any common YouTube URL shape:
 * watch?v=, youtu.be/, shorts/, live/, embed/, or a bare 11-char id.
 */
export function parseYouTubeUrl(input: string): ParsedYouTube | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	if (VIDEO_ID_RE.test(trimmed)) {
		return { videoId: trimmed, playlistId: null, start: 0 };
	}

	let url: URL;
	try {
		url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
	} catch {
		return null;
	}

	const host = url.hostname.replace(/^www\.|^m\./, "");
	if (
		host !== "youtube.com" &&
		host !== "youtu.be" &&
		host !== "youtube-nocookie.com" &&
		host !== "music.youtube.com"
	) {
		return null;
	}

	const start = parseTimestamp(
		url.searchParams.get("t") ?? url.searchParams.get("start") ?? "0",
	);
	const playlistId = url.searchParams.get("list");

	let videoId: string | null = null;
	if (host === "youtu.be") {
		videoId = url.pathname.slice(1).split("/")[0] || null;
	} else if (url.searchParams.has("v")) {
		videoId = url.searchParams.get("v");
	} else {
		const pathMatch = url.pathname.match(
			/^\/(?:shorts|live|embed|v)\/([\w-]{11})/,
		);
		if (pathMatch) videoId = pathMatch[1];
	}

	if (videoId && !VIDEO_ID_RE.test(videoId)) videoId = null;
	if (!videoId && !playlistId) return null;

	return { videoId, playlistId, start };
}

/** Build a privacy-enhanced embed URL for the iframe */
export function buildEmbedUrl(parsed: ParsedYouTube): string {
	const params = new URLSearchParams({ autoplay: "1", rel: "0" });
	if (parsed.start > 0) params.set("start", String(parsed.start));

	if (parsed.videoId) {
		if (parsed.playlistId) params.set("list", parsed.playlistId);
		return `https://www.youtube-nocookie.com/embed/${parsed.videoId}?${params}`;
	}
	params.set("listType", "playlist");
	params.set("list", parsed.playlistId!);
	return `https://www.youtube-nocookie.com/embed/videoseries?${params}`;
}

/** Fetch a video's title via YouTube's oEmbed endpoint (no API key needed) */
export async function fetchVideoTitle(input: string): Promise<string | null> {
	const parsed = parseYouTubeUrl(input);
	if (!parsed) return null;
	const watchUrl = parsed.videoId
		? `https://www.youtube.com/watch?v=${parsed.videoId}`
		: `https://www.youtube.com/playlist?list=${parsed.playlistId}`;
	try {
		const res = await requestUrl(
			`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
		);
		const json: unknown = res.json;
		if (!json || typeof json !== "object") return null;
		const title = (json as { title?: unknown }).title;
		return typeof title === "string" ? title : null;
	} catch {
		return null;
	}
}

export interface SearchResult {
	videoId: string;
	title: string;
	channel: string;
	duration: string;
}

/** Recursively collect every `videoRenderer` object in ytInitialData */
function collectVideoRenderers(node: unknown, out: unknown[]) {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const child of node) collectVideoRenderers(child, out);
		return;
	}
	const obj = node as Record<string, unknown>;
	if (obj.videoRenderer && typeof obj.videoRenderer === "object") {
		out.push(obj.videoRenderer);
	}
	for (const value of Object.values(obj)) collectVideoRenderers(value, out);
}

function asString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

/** Extract `.runs[0].text` from a ytInitialData text object */
function runText(value: unknown): string | null {
	if (!value || typeof value !== "object") return null;
	const runs = (value as { runs?: unknown }).runs;
	if (!Array.isArray(runs)) return null;
	const first: unknown = runs[0];
	if (!first || typeof first !== "object") return null;
	return asString((first as { text?: unknown }).text);
}

/** Extract `.simpleText` from a ytInitialData text object */
function simpleText(value: unknown): string | null {
	if (!value || typeof value !== "object") return null;
	return asString((value as { simpleText?: unknown }).simpleText);
}

/**
 * Search YouTube without an API key by parsing the `ytInitialData` JSON
 * embedded in the regular search results page.
 */
export async function searchYouTube(query: string): Promise<SearchResult[]> {
	const res = await requestUrl(
		`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
	);
	const html = res.text;
	const marker = "var ytInitialData = ";
	const start = html.indexOf(marker);
	if (start === -1) return [];
	const end = html.indexOf(";</script>", start);
	if (end === -1) return [];

	let data: unknown;
	try {
		data = JSON.parse(html.slice(start + marker.length, end));
	} catch {
		return [];
	}

	const renderers: unknown[] = [];
	collectVideoRenderers(data, renderers);

	const results: SearchResult[] = [];
	for (const renderer of renderers) {
		if (!renderer || typeof renderer !== "object") continue;
		const obj = renderer as Record<string, unknown>;
		const videoId = asString(obj.videoId);
		if (!videoId) continue;
		results.push({
			videoId,
			title: runText(obj.title) ?? "(untitled)",
			channel: runText(obj.ownerText) ?? "",
			duration: simpleText(obj.lengthText) ?? "",
		});
		if (results.length >= 20) break;
	}
	return results;
}

/** Find the first YouTube URL (or bare video id) inside a chunk of text */
export function findYouTubeUrlInText(text: string): string | null {
	const urlRe = /https?:\/\/[^\s)\]>"']+/g;
	for (const match of text.matchAll(urlRe)) {
		if (parseYouTubeUrl(match[0])) return match[0];
	}
	return null;
}
