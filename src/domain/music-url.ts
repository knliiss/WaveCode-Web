const supportedHosts = new Set([
  "music.youtube.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.tiktok.com",
  "tiktok.com",
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
  "www.instagram.com",
  "instagram.com",
]);

const noNativeMomentHosts = new Set([
  "www.tiktok.com",
  "tiktok.com",
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
    return true;
  } catch {
    return false;
  }
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
      if (host === "vt.tiktok.com" || host === "vm.tiktok.com") {
        return "Open the TikTok share link and copy the full video URL. Short redirects cannot be encoded permanently without resolving them.";
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
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === "music.youtube.com") return "YouTube Music";
    if (host === "youtu.be" || host.endsWith("youtube.com")) {
      return url.pathname.startsWith("/shorts/") ? "YouTube Shorts" : "YouTube";
    }
    if (host === "tiktok.com" || host === "www.tiktok.com") return "TikTok";
    if (host === "instagram.com" || host === "www.instagram.com") return "Instagram Reels";
    if (host.includes("spotify")) return "Spotify";
    if (host.includes("apple")) return "Apple Music";
    if (host.includes("deezer")) return "Deezer";
    if (host.includes("tidal")) return "TIDAL";
    if (host.includes("qobuz")) return "Qobuz";
    if (host.includes("amazon")) return "Amazon Music";
  } catch {
    // Invalid links are handled by the codec and are never opened.
  }
  return "Media link";
}

export function musicIdentity(value: string): string {
  try {
    const url = new URL(value);
    return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).at(-1) || "Media";
  } catch {
    return "Media";
  }
}
