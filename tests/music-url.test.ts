import { describe, expect, it } from "vitest";
import { isSupportedMusicUrl, isVideoUrl, musicIdentity, parseMoment, platformLabel, prettyMoment, supportsNativeMoment, validateMusicLink } from "../src/domain/music-url";

describe("public music link security", () => {
  it("accepts known music providers over https", () => {
    expect(isSupportedMusicUrl("https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b")).toBe(true);
    expect(isSupportedMusicUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ&t=59")).toBe(true);
    expect(isSupportedMusicUrl("https://music.apple.com/ua/song/12345")).toBe(true);
  });
  it("rejects hostile origins and unsafe protocols", () => {
    for (const url of [
      "javascript:alert(1)", "data:text/html,hello",
      "https://spotify.com.evil.example/track/123",
      "https://open.spotify.com@evil.example/track/123",
      "http://open.spotify.com/track/123",
      "https://open.spotify.com:443/track/123",
      "https://open.spotify.com:444/track/123",
      "",
    ]) expect(isSupportedMusicUrl(url)).toBe(false);
  });
  it("reports a helpful error for unrecognized links", () => {
    expect(validateMusicLink("https://example.com")).toContain("supported HTTPS media link");
    expect(validateMusicLink("")).toContain("Paste");
  });
  it("displays music identity without fetching metadata", () => {
    const url = "https://music.youtube.com/watch?v=dQw4w9WgXcQ&t=59";
    expect(musicIdentity(url)).toBe("dQw4w9WgXcQ");
    expect(platformLabel(url)).toBe("YouTube Music");
  });
});

describe("video link handling", () => {
  it("recognizes native platform URLs without embedded or proxy players", () => {
    for (const [url, label] of [
      ["https://www.youtube.com/watch?v=JGwWNGJdvx8", "YouTube"],
      ["https://youtu.be/JGwWNGJdvx8?t=95", "YouTube"],
      ["https://www.youtube.com/shorts/JGwWNGJdvx8", "YouTube Shorts"],
      ["https://www.tiktok.com/@creator/video/7300873037530795272", "TikTok"],
      ["https://www.tiktok.com/@/video/7300873037530795272", "TikTok"],
      ["https://vt.tiktok.com/ZSp94BeDn/", "TikTok"],
      ["https://www.instagram.com/reel/DIPPWkUh7Rj/", "Instagram Reels"],
    ] as const) {
      expect(isSupportedMusicUrl(url)).toBe(true);
      expect(isVideoUrl(url)).toBe(true);
      expect(platformLabel(url)).toBe(label);
      expect(validateMusicLink(url)).toBeNull();
    }
    expect(isVideoUrl("https://music.youtube.com/watch?v=JGwWNGJdvx8")).toBe(false);
    expect(musicIdentity("https://www.instagram.com/reel/DIPPWkUh7Rj/")).toBe("DIPPWkUh7Rj");
  });

  it("only enables native timestamps on media providers that support them", () => {
    expect(supportsNativeMoment("https://www.youtube.com/shorts/JGwWNGJdvx8")).toBe(true);
    expect(supportsNativeMoment("https://www.youtube.com/watch?v=JGwWNGJdvx8")).toBe(true);
    expect(supportsNativeMoment("https://www.tiktok.com/@creator/video/7300873037530795272")).toBe(false);
    expect(supportsNativeMoment("https://vt.tiktok.com/ZSp94BeDn/")).toBe(false);
    expect(validateMusicLink("https://vt.tiktok.com/ZSp94BeDn/?t=15")).toContain("do not support");
    expect(supportsNativeMoment("https://www.instagram.com/reel/DIPPWkUh7Rj/")).toBe(false);
    expect(validateMusicLink("https://www.instagram.com/reel/DIPPWkUh7Rj/?t=15")).toContain("do not support");
  });

  it("rejects lookalike video origins and invalid TikTok shortcodes", () => {
    expect(isSupportedMusicUrl("https://www.tiktok.com.evil.test/@x/video/7300873037530795272")).toBe(false);
    expect(isSupportedMusicUrl("https://www.instagram.com@evil.test/reel/DIPPWkUh7Rj/")).toBe(false);
    expect(isSupportedMusicUrl("http://www.youtube.com/shorts/JGwWNGJdvx8")).toBe(false);
    expect(validateMusicLink("https://vt.tiktok.com/ZSp94BeDn/")).toBeNull();
    expect(validateMusicLink("https://vt.tiktok.com/ZSp94BeDn/?_t=1")).toBeNull();
    expect(musicIdentity("https://vt.tiktok.com/ZSp94BeDn/")).toBe("ZSp94BeDn");
    for (const invalid of [
      "https://vt.tiktok.com/",
      "https://vt.tiktok.com/ZSp94BeDn-/",
      "https://vt.tiktok.com/ZSp94BeDn/extra",
      "https://vt.tiktok.com/12345678901234567/",
      "https://vt.tiktok.com.evil.example/ZSp94BeDn/",
      "https://vt.tiktok.com@evil.example/ZSp94BeDn/",
      "http://vt.tiktok.com/ZSp94BeDn/",
    ]) {
      expect(isSupportedMusicUrl(invalid)).toBe(false);
    }
    expect(validateMusicLink("https://vm.tiktok.com/ZSp94BeDn/")).toContain("vt.tiktok.com");
  });
});

describe("moments", () => {
  it("accepts seconds, mm:ss and hh:mm:ss", () => {
    expect(parseMoment("59")).toBe(59);
    expect(parseMoment("00:59")).toBe(59);
    expect(parseMoment("1:03")).toBe(63);
    expect(parseMoment("1:02:03")).toBe(3723);
    expect(parseMoment("")).toBeUndefined();
  });
  it("rejects invalid timestamps and preserves upper limit", () => {
    expect(parseMoment("18:12:15")).toBe(65535);
    expect(() => parseMoment("18:12:16")).toThrow();
    expect(() => parseMoment("1:99")).toThrow();
    expect(() => parseMoment("-1")).toThrow();
  });
  it("formats values consistently", () => {
    expect(prettyMoment(59)).toBe("00:59");
    expect(prettyMoment(3661)).toBe("1:01:01");
  });
});
