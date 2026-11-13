import { describe, expect, it } from "vitest";
import { normalizeMediaInput } from "../src/domain/normalize-media-input";

describe("media share link cleanup and timestamp extraction", () => {
  it.each([
    [
      "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b?si=oldsource&t=187&utm_source=share",
      "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
      "03:07",
    ],
    [
      "https://music.youtube.com/watch?v=JGwWNGJdvx8&list=RDAMVMabc&t=59&feature=share",
      "https://music.youtube.com/watch?v=JGwWNGJdvx8",
      "00:59",
    ],
    [
      "https://youtu.be/JGwWNGJdvx8?si=token&t=1m35s",
      "https://www.youtube.com/watch?v=JGwWNGJdvx8",
      "01:35",
    ],
    [
      "https://www.youtube.com/shorts/JGwWNGJdvx8?start=260&utm_campaign=share",
      "https://www.youtube.com/shorts/JGwWNGJdvx8",
      "04:20",
    ],
    [
      "https://music.apple.com/ua/album/name/12345?i=67890&t=1h2m3s",
      "https://music.apple.com/ua/song/67890",
      "1:02:03",
    ],
    [
      "https://music.amazon.com/albums/B012345678?trackAsin=B012345678&t=42",
      "https://music.amazon.com/tracks/B012345678",
      "00:42",
    ],
    [
      "https://www.tiktok.com/@creator/video/7300873037530795272?_t=abc&utm_source=copy",
      "https://www.tiktok.com/@/video/7300873037530795272",
      "",
    ],
    [
      "https://vt.tiktok.com/ZSp94BeDn/?utm_source=share",
      "https://vt.tiktok.com/ZSp94BeDn/",
      "",
    ],
    [
      "https://www.instagram.com/reel/DIPPWkUh7Rj/?igsh=xyz",
      "https://www.instagram.com/reel/DIPPWkUh7Rj/",
      "",
    ],
  ])("strips tracking data from %s", (input, link, moment) => {
    expect(normalizeMediaInput(input)).toEqual({ link, moment });
  });

  it("rejects unsupported or ambiguous timestamps instead of losing them", () => {
    expect(() => normalizeMediaInput("https://www.youtube.com/watch?v=JGwWNGJdvx8&t=59&t=60"))
      .toThrow(/conflicting/);
    expect(() => normalizeMediaInput("https://www.youtube.com/watch?v=JGwWNGJdvx8&t=2h"))
      .not.toThrow();
    expect(() => normalizeMediaInput("https://www.youtube.com/watch?v=JGwWNGJdvx8&t=999999"))
      .toThrow();
    expect(() => normalizeMediaInput("https://vt.tiktok.com/ZSp94BeDn/?t=59"))
      .toThrow(/do not support/);
    expect(() => normalizeMediaInput("https://www.youtube.com/watch?v=JGwWNGJdvx8&t=unknown"))
      .toThrow(/unsupported/);
  });

  it("never transforms a malicious origin into a trusted link", () => {
    const hostile = "https://open.spotify.com@evil.example/track/0VjIjW4GlUZAMYd2vXMi3b?t=42";
    expect(normalizeMediaInput(hostile).link).toBe(hostile);
  });
});
