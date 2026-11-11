import { describe, expect, it } from "vitest";
import { isSupportedMusicUrl, musicIdentity, parseMoment, platformLabel, prettyMoment, validateMusicLink } from "../src/domain/music-url";

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
      "",
    ]) expect(isSupportedMusicUrl(url)).toBe(false);
  });
  it("reports a helpful error for unrecognized links", () => {
    expect(validateMusicLink("https://example.com")).toContain("supported HTTPS music link");
    expect(validateMusicLink("")).toContain("Paste");
  });
  it("displays music identity without fetching metadata", () => {
    const url = "https://music.youtube.com/watch?v=dQw4w9WgXcQ&t=59";
    expect(musicIdentity(url)).toBe("dQw4w9WgXcQ");
    expect(platformLabel(url)).toBe("YouTube Music");
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
