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
		const title = res.json?.title;
		return typeof title === "string" ? title : null;
	} catch {
		return null;
	}
}

/** Find the first YouTube URL (or bare video id) inside a chunk of text */
export function findYouTubeUrlInText(text: string): string | null {
	const urlRe = /https?:\/\/[^\s)\]>"']+/g;
	for (const match of text.matchAll(urlRe)) {
		if (parseYouTubeUrl(match[0])) return match[0];
	}
	return null;
}
