import { isSupportedMusicUrl, parseMoment, prettyMoment, supportsNativeMoment } from "./music-url";

export interface NormalizedMediaInput {
  link: string;
  moment: string;
}

function secondsInUrl(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (/^\d+s?$/.test(trimmed)) {
    return parseMoment(trimmed.replace(/s$/, ""))!;
  }
  if (/^\d{1,5}(?::\d{1,2}){1,2}$/.test(trimmed)) {
    return parseMoment(trimmed)!;
  }
  const units = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(trimmed);
  if (!units || !units.slice(1).some(Boolean)) {
    throw new Error("The link contains an unsupported timestamp.");
  }
  const total = Number(units[1] ?? 0) * 3600 +
    Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  if (!Number.isSafeInteger(total) || total > 65535) {
    throw new Error("The timestamp must not exceed 18:12:15.");
  }
  return total;
}

function extractMoment(url: URL): number | undefined {
  const candidates: string[] = [];
  for (const name of ["t", "start", "time_continue"]) {
    candidates.push(...url.searchParams.getAll(name));
  }
  if (/^#t=/i.test(url.hash)) candidates.push(decodeURIComponent(url.hash.slice(3)));
  if (!candidates.length) return undefined;
  const values = candidates.map(secondsInUrl);
  if (values.some((value) => value !== values[0])) {
    throw new Error("The link contains conflicting timestamps.");
  }
  return values[0];
}

function canonicalIdentity(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  const video = url.searchParams.get("v");
  const youtubeId = /^[A-Za-z0-9_-]{11}$/;
  if (host === "music.youtube.com" && parts.join("/") === "watch" &&
    video && youtubeId.test(video)) {
    return "https://music.youtube.com/watch?v=" + video;
  }
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    if (parts.join("/") === "watch" && video && youtubeId.test(video)) {
      return "https://www.youtube.com/watch?v=" + video;
    }
    if (parts.length === 2 && parts[0] === "shorts" && youtubeId.test(parts[1]!)) {
      return "https://www.youtube.com/shorts/" + parts[1];
    }
  }
  if (host === "youtu.be" && parts.length === 1 && youtubeId.test(parts[0]!)) {
    return "https://www.youtube.com/watch?v=" + parts[0];
  }
  if (host === "open.spotify.com" && parts.length === 2 && parts[0] === "track" &&
    /^[A-Za-z0-9]{22}$/.test(parts[1]!)) {
    return "https://open.spotify.com/track/" + parts[1];
  }
  if (["tiktok.com", "www.tiktok.com"].includes(host) && parts.length === 3 &&
    parts[0]!.startsWith("@") && parts[1] === "video" && /^\d+$/.test(parts[2]!)) {
    return "https://www.tiktok.com/@/video/" + parts[2];
  }
  if (host === "vt.tiktok.com" && parts.length === 1 && /^[A-Za-z0-9]{1,16}$/.test(parts[0]!)) {
    return "https://vt.tiktok.com/" + parts[0] + "/";
  }
  if (["instagram.com", "www.instagram.com"].includes(host) && parts.length === 2 &&
    ["reel", "reels"].includes(parts[0]!) && /^[A-Za-z0-9_-]{1,16}$/.test(parts[1]!)) {
    return "https://www.instagram.com/reel/" + parts[1] + "/";
  }
  if (host === "music.apple.com" && parts.length >= 3 && /^[a-z]{2}$/.test(parts[0]!)) {
    const id = parts[1] === "song" ? parts.at(-1) :
      parts[1] === "album" ? url.searchParams.get("i") : null;
    if (id && /^\d+$/.test(id)) return "https://music.apple.com/" + parts[0] + "/song/" + id;
  }
  if (["www.deezer.com", "deezer.com"].includes(host) && parts.length === 2 &&
    parts[0] === "track" && /^\d+$/.test(parts[1]!)) {
    return "https://www.deezer.com/track/" + parts[1];
  }
  if (["tidal.com", "www.tidal.com", "listen.tidal.com"].includes(host) &&
    ((parts.length === 2 && parts[0] === "track") ||
     (parts.length === 3 && parts[0] === "browse" && parts[1] === "track")) &&
    /^\d+$/.test(parts.at(-1)!)) {
    return "https://tidal.com/browse/track/" + parts.at(-1);
  }
  if (["open.qobuz.com", "play.qobuz.com"].includes(host) && parts.length === 2 &&
    parts[0] === "track" && /^\d+$/.test(parts[1]!)) {
    return "https://open.qobuz.com/track/" + parts[1];
  }
  if (host === "music.amazon.com") {
    const asin = parts.length === 2 && parts[0] === "tracks" ? parts[1] :
      parts.length === 2 && parts[0] === "albums" ? url.searchParams.get("trackAsin") : null;
    if (asin && /^[A-Z0-9]{10}$/.test(asin)) {
      return "https://music.amazon.com/tracks/" + asin;
    }
  }
  return null;
}

/** Remove share/tracking parameters and move the native timestamp into its own field. */
export function normalizeMediaInput(value: string): NormalizedMediaInput {
  const original = value.trim();
  if (!isSupportedMusicUrl(original)) return { link: original, moment: "" };
  const url = new URL(original);
  const seconds = extractMoment(url);
  if (seconds !== undefined && !supportsNativeMoment(original)) {
    throw new Error("TikTok and Instagram do not support native timestamps.");
  }
  const canonical = canonicalIdentity(url);
  return {
    link: canonical ?? original,
    moment: seconds === undefined ? "" : prettyMoment(seconds),
  };
}
