const supportedHosts = new Set([
  "music.youtube.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
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

export function validateMusicLink(value: string): string | null {
  if (!value.trim()) return "Paste a music link to get started.";
  if (value.length > 4096) return "The link is too long.";
  if (!isSupportedMusicUrl(value)) {
    return "Use a supported HTTPS music link from YouTube Music, Spotify, Apple Music, Deezer, TIDAL, Qobuz or Amazon Music.";
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
    const host = new URL(value).hostname;
    if (host.includes("youtube") || host === "youtu.be") return "YouTube Music";
    if (host.includes("spotify")) return "Spotify";
    if (host.includes("apple")) return "Apple Music";
    if (host.includes("deezer")) return "Deezer";
    if (host.includes("tidal")) return "TIDAL";
    if (host.includes("qobuz")) return "Qobuz";
    if (host.includes("amazon")) return "Amazon Music";
  } catch {
    // Invalid links are handled by the codec and are never opened.
  }
  return "Music link";
}

export function musicIdentity(value: string): string {
  try {
    const url = new URL(value);
    return url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).at(-1) || "Track";
  } catch {
    return "Track";
  }
}
