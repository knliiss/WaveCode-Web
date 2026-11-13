import { platformFromUrl } from "./platform";

const supportedHosts = new Set([
  "music.youtube.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.tiktok.com",
  "tiktok.com",
  "vt.tiktok.com",
  "www.instagram.com",
  "instagram.com",
  "open.spotify.com",
  "music.apple.com",
  "deezer.com",
  "www.deezer.com",
  "tidal.com",
  "www.tidal.com",
  "listen.tidal.com",
  "open.qobuz.com",
  "play.qobuz.com",
  "music.amazon.com",
]);

const videoHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.tiktok.com",
  "tiktok.com",
  "vt.tiktok.com",
  "www.instagram.com",
  "instagram.com",
]);

const noNativeMomentHosts = new Set([
  "www.tiktok.com",
  "tiktok.com",
  "vt.tiktok.com",
  "www.instagram.com",
  "instagram.com",
]);

export function isSupportedMusicUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !supportedHosts.has(url.hostname.toLowerCase())) {
      return false;
    }
    const authority = value.trim().match(/^https:\/\/([^/?#]+)/i)?.[1] ?? "";
    if (url.username || url.password || url.port || authority.includes(":") || authority.includes("@")) {
      return false;
    }
    if (url.hostname.toLowerCase() === "vt.tiktok.com") {
      return /^\/[A-Za-z0-9]{1,16}\/?$/.test(url.pathname);
    }
    return true;
  } catch {
    return false;
  }
}

export function parseDualTrackIds(spotifyLink: string, youtubeMusicLink: string): {
  spotifyId: string;
  youtubeMusicId: string;
} | null {
  if (!isSupportedMusicUrl(spotifyLink) || !isSupportedMusicUrl(youtubeMusicLink)) {
    return null;
  }
  const spotify = new URL(spotifyLink.trim());
  const youtube = new URL(youtubeMusicLink.trim());
  if (spotify.hostname !== "open.spotify.com" ||
      youtube.hostname !== "music.youtube.com" ||
      youtube.pathname !== "/watch") {
    return null;
  }
  const match = /^\/track\/([A-Za-z0-9]{22})\/?$/.exec(spotify.pathname);
  const youtubeId = youtube.searchParams.get("v");
  if (!match || !youtubeId || !/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    return null;
  }
  return { spotifyId: match[1]!, youtubeMusicId: youtubeId };
}

export function supportsNativeMoment(value: string): boolean {
  try {
    return !noNativeMomentHosts.has(new URL(value.trim()).hostname.toLowerCase());
  } catch {
    return true;
  }
}

export function isVideoUrl(value: string): boolean {
  try {
    return videoHosts.has(new URL(value.trim()).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function validateMusicLink(value: string): string | null {
  if (!value.trim()) return "Paste a media link to get started.";
  if (value.length > 4096) return "The link is too long.";
  if (!isSupportedMusicUrl(value)) {
    try {
      const host = new URL(value.trim()).hostname.toLowerCase();
      if (host === "vm.tiktok.com") {
        return "Use a vt.tiktok.com short link or the full TikTok video URL.";
      }
    } catch {
      // Fall through to the supported media error.
    }
    return "Use a supported HTTPS media link from YouTube, Shorts, TikTok, Instagram Reels or a supported music service.";
  }

  if (!supportsNativeMoment(value) && new URL(value.trim()).searchParams.has("t")) {
    return "TikTok and Instagram Reels do not support opening a moment through their native links.";
  }

  return null;
}

export function parseMoment(text: string): number | undefined {
  const source = text.trim();
  if (!source) return undefined;
  if (!/^\d{1,5}(?::[0-5]?\d){0,2}$/.test(source)) {
    throw new Error("Use seconds, mm:ss or hh:mm:ss.");
  }
  const parts = source.split(":").map(Number);
  const total = parts.reduce((sum, part) => sum * 60 + part, 0);
  if (!Number.isInteger(total) || total > 65535) {
    throw new Error("The timestamp must not exceed 18:12:15.");
  }
  return total;
}

export function prettyMoment(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const padded = (value: number) => String(value).padStart(2, "0");
  return h > 0 ? h + ":" + padded(m) + ":" + padded(s) : padded(m) + ":" + padded(s);
}

export function platformLabel(value: string): string {
  return platformFromUrl(value)?.label ?? "Media link";
}

export function musicIdentity(value: string): string {
  try {
    const url = new URL(value);
    return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).at(-1) || "Media";
  } catch {
    return "Media";
  }
}
