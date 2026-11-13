import { describe, expect, it } from "vitest";
import { platformFromUrl } from "../src/domain/platform";
import { platformLabel } from "../src/domain/music-url";

describe("platform identity and round logos", () => {
  const platforms = [
    ["https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b", "spotify", "Spotify"],
    ["https://music.youtube.com/watch?v=JGwWNGJdvx8", "youtube-music", "YouTube Music"],
    ["https://www.youtube.com/watch?v=JGwWNGJdvx8", "youtube", "YouTube"],
    ["https://www.youtube.com/shorts/JGwWNGJdvx8", "youtube-shorts", "YouTube Shorts"],
    ["https://youtu.be/JGwWNGJdvx8", "youtube", "YouTube"],
    ["https://www.tiktok.com/@test/video/7300873037530795272", "tiktok", "TikTok"],
    ["https://vt.tiktok.com/ZSp94BeDn/", "tiktok", "TikTok"],
    ["https://www.instagram.com/reel/DIPPWkUh7Rj/", "instagram", "Instagram Reels"],
    ["https://music.apple.com/ua/song/12345", "apple-music", "Apple Music"],
    ["https://www.deezer.com/track/12345", "deezer", "Deezer"],
    ["https://tidal.com/browse/track/12345", "tidal", "TIDAL"],
    ["https://play.qobuz.com/track/12345", "qobuz", "Qobuz"],
    ["https://music.amazon.com/tracks/B012345678", "amazon-music", "Amazon Music"],
  ] as const;

  it.each(platforms)("maps %s to local %s artwork", (url, id, name) => {
    const platform = platformFromUrl(url);
    expect(platform?.id).toBe(id);
    expect(platform?.label).toBe(name);
    expect(platformLabel(url)).toBe(name);
    if (id !== "amazon-music") {
      expect(platform?.icon).toMatch(/^\/platforms\/[a-z]+\.svg$/);
    } else {
      expect(platform?.fallback).toBe("a");
    }
  });

  it("never associates a badge with untrusted or malformed origins", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://open.spotify.com/track/123",
      "https://open.spotify.com@evil.test/track/123",
      "https://spotify.com.evil.test/track/123",
      "https://open.spotify.com:444/track/123",
      "https://music.youtube.com.evil.test/watch?v=123",
      "",
    ]) {
      expect(platformFromUrl(url)).toBeNull();
      expect(platformLabel(url)).toBe("Media link");
    }
  });

  it("uses different visual identities for the two Dual destinations", () => {
    const spotify = platformFromUrl("https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b");
    const youtube = platformFromUrl("https://music.youtube.com/watch?v=JGwWNGJdvx8");
    expect(spotify?.id).not.toBe(youtube?.id);
    expect(spotify?.icon).not.toBe(youtube?.icon);
    expect(spotify?.color).not.toBe(youtube?.color);
  });
});
