import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createLegacyV1Png } from "./legacy-v1";

const TRACK = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";
const EXPECTED = TRACK + "?t=59";

async function expectPlatformIcon(page: Page, platform: string) {
  const icon = page.locator('.result-sheet .platform-badge[data-platform="' + platform + '"]').first();
  await expect(icon).toBeVisible();
  const image = icon.locator("img");
  await expect(image).toHaveAttribute("src", /\/platforms\/[a-z]+\.svg$/);
  await expect.poll(async () =>
    image.evaluate((element) => {
      const asset = element as HTMLImageElement;
      return asset.complete && asset.naturalWidth > 0;
    }),
  ).toBe(true);
}

test("generate, download and decode the same WaveCode entirely in the browser", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the moment/ })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await navigation.getByRole("button", { name: /Create/ }).click();

  await expect(page.getByRole("heading", { name: /Make it yours/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Music or video link" }).fill(TRACK);
  await page.getByRole("textbox", { name: "Start at a moment" }).fill("00:59");
  await page.getByRole("button", { name: "Create WaveCode" }).click();

  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy WaveCode image" })).toBeVisible();
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG" }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe("wavecode.png");
  const filepath = await download.path();
  if (!filepath) throw new Error("The generated PNG was not downloaded.");

  if (testInfo.project.name === "mobile-chromium") {
    await page.screenshot({ path: "test-results/mobile-create.png", fullPage: true });
  }

  await navigation.getByRole("button", { name: /Scan/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "wavecode.png",
    mimeType: "image/png",
    buffer: readFileSync(filepath),
  });
  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });

  const link = page.getByRole("link", { name: /Open track/ });
  await expect(link).toHaveAttribute("href", EXPECTED);
  await expect(page.getByText("Spotify", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expectPlatformIcon(page, "spotify");

  if (testInfo.project.name === "mobile-chromium") {
    await page.screenshot({ path: "test-results/mobile-scan-result.png", fullPage: true });
  }

  expect(pageErrors).toEqual([]);
});

test("mobile-friendly layout and accessible camera fallback", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open camera" })).toBeVisible();
  await expect(page.getByRole("button", { name: "From photo" })).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({ path: "test-results/mobile-home.png", fullPage: true });
  }
});

test("V2 Dual round-trips two independent links with a smaller W", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: /Create/ }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" }).fill(TRACK);
  await page.getByRole("textbox", { name: "Second media link" })
    .fill("https://music.youtube.com/watch?v=JGwWNGJdvx8");
  await page.getByRole("textbox", { name: "First start moment" }).fill("00:59");
  await page.getByRole("textbox", { name: "Second start moment" }).fill("00:59");
  await expect(page.locator('.creator-form [data-platform="spotify"]')).toBeVisible();
  await expect(page.locator('.creator-form [data-platform="youtube-music"]')).toBeVisible();

  await page.getByText("Adjust proportions").click();
  const logoSize = page.getByRole("slider", { name: "W size" });
  await logoSize.focus();
  await logoSize.press("Home");
  for (let i = 0; i < 20; i++) await logoSize.press("ArrowRight");
  await expect(logoSize).toHaveValue("110");

  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  const downloadReady = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG" }).click();
  const download = await downloadReady;
  const file = await download.path();
  if (!file) throw new Error("V2 PNG was not downloaded.");

  await nav.getByRole("button", { name: /Scan/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "wavecode-v2-dual.png",
    mimeType: "image/png",
    buffer: readFileSync(file),
  });
  await expect(page.getByText("DUAL CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expectPlatformIcon(page, "spotify");
  await expectPlatformIcon(page, "youtube-music");
  await expect(page.getByText("Two independent links. Open either platform.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Spotify" }))
    .toHaveAttribute("href", TRACK + "?t=59");
  await expect(page.getByRole("link", { name: "Open YouTube Music" }))
    .toHaveAttribute("href", "https://music.youtube.com/watch?v=JGwWNGJdvx8&t=59");
});

test("V2 Single is scanned in the same UI as V1 and keeps its provider mark", async ({ page }) => {
  const original = "https://music.youtube.com/watch?v=JGwWNGJdvx8&t=59";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: /Create/ }).click();
  await expect(page.getByRole("button", { name: /V1 · classic/ })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Music or video link" }).fill(original);
  await expect(page.locator('.creator-form [data-platform="youtube-music"]')).toBeVisible();
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const imagePath = await download.path();
  if (!imagePath) throw new Error("No V2 PNG was exported.");

  await nav.getByRole("button", { name: /Scan/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "wavecode-v2-single.png",
    mimeType: "image/png",
    buffer: readFileSync(imagePath),
  });
  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expectPlatformIcon(page, "youtube-music");
  await expect(page.getByRole("link", { name: "Open track" }))
    .toHaveAttribute("href", original);
});

test("V1 remains scan-compatible even though V1 creation is hidden", async ({ page }) => {
  await page.goto("/");
  const legacy = await createLegacyV1Png(page, TRACK, 59);
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "legacy-wavecode.png",
    mimeType: "image/png",
    buffer: legacy,
  });
  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V1");
  await expectPlatformIcon(page, "spotify");
  await expect(page.getByRole("link", { name: "Open track" }))
    .toHaveAttribute("href", EXPECTED);
});

test("V2 Dual scans arbitrary platforms with independent moments", async ({ page }) => {
  const first = "https://open.spotify.com/track/zzzzzzzzzzzzzzzzzzzzzz";
  const second = "https://open.spotify.com/track/0000000000000000000000";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" }).fill(first);
  await page.getByRole("textbox", { name: "Second media link" }).fill(second);
  await page.getByRole("textbox", { name: "First start moment" }).fill("01:15");
  await page.getByRole("textbox", { name: "Second start moment" }).fill("00:40");
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  const preview = page.getByRole("img", { name: "Generated WaveCode preview" });
  await expect(preview).toBeVisible();
  const rails = preview.locator(".data-upper");
  await expect.poll(() => rails.count()).toBeGreaterThan(34);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const file = await download.path();
  if (!file) throw new Error("No generic Dual PNG was downloaded.");
  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "generic-dual.png",
    mimeType: "image/png",
    buffer: readFileSync(file),
  });
  await expect(page.getByText("DUAL CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V2");
  const links = page.getByRole("link", { name: "Open Spotify" });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", first + "?t=75");
  await expect(links.nth(1)).toHaveAttribute("href", second + "?t=40");
});

test("V2 Dual supports video-to-video links with no moments", async ({ page }) => {
  const tiktok = "https://vt.tiktok.com/ZSp94BeDn/";
  const instagram = "https://www.instagram.com/reel/DIPPWkUh7Rj/";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" }).fill(tiktok);
  await page.getByRole("textbox", { name: "Second media link" }).fill(instagram);
  await expect(page.getByRole("textbox", { name: "First start moment" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Second start moment" })).toHaveCount(0);
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("No video Dual PNG was downloaded.");
  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "dual-videos.png",
    mimeType: "image/png",
    buffer: readFileSync(path),
  });
  await expect(page.getByText("DUAL CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole("link", { name: "Open TikTok" })).toHaveAttribute("href", tiktok);
  await expect(page.getByRole("link", { name: "Open Instagram Reels" }))
    .toHaveAttribute("href", instagram);
});

test("pasting a timed shared URL cleans the link and fills the moment field", async ({ page }) => {
  const spotify = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Create" }).click();
  await page.getByRole("textbox", { name: "Music or video link" })
    .fill(spotify + "?si=tracking&t=187&utm_source=share");
  await page.getByRole("button", { name: "Create WaveCode" }).focus();
  await expect(page.getByRole("textbox", { name: "Music or video link" }))
    .toHaveValue(spotify);
  await expect(page.getByRole("textbox", { name: "Start at a moment" }))
    .toHaveValue("03:07");
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Spotify" }))
    .toHaveAttribute("href", spotify + "?t=187");
});

test("Dual import moves each native timestamp into its own editor field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" })
    .fill("https://music.youtube.com/watch?v=JGwWNGJdvx8&list=abc&t=1m35s");
  await page.getByRole("textbox", { name: "Second media link" })
    .fill("https://www.youtube.com/shorts/JGwWNGJdvx8?start=17&feature=share");
  await page.getByRole("button", { name: "Create WaveCode" }).focus();

  await expect(page.getByRole("textbox", { name: "First media link" }))
    .toHaveValue("https://music.youtube.com/watch?v=JGwWNGJdvx8");
  await expect(page.getByRole("textbox", { name: "Second media link" }))
    .toHaveValue("https://www.youtube.com/shorts/JGwWNGJdvx8");
  await expect(page.getByRole("textbox", { name: "First start moment" }))
    .toHaveValue("01:35");
  await expect(page.getByRole("textbox", { name: "Second start moment" }))
    .toHaveValue("00:17");

  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open YouTube Music" }))
    .toHaveAttribute("href", "https://music.youtube.com/watch?v=JGwWNGJdvx8&t=95");
  await expect(page.getByRole("link", { name: "Open YouTube", exact: true }))
    .toHaveAttribute("href", "https://www.youtube.com/watch?v=JGwWNGJdvx8&t=17");
});

test("V2 general Dual Apple Music pair decodes at a legacy-overlapping column length", async ({ page }) => {
  const first = "https://music.apple.com/ua/song/12345";
  const second = "https://music.apple.com/us/song/67890";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" }).fill(first);
  await page.getByRole("textbox", { name: "Second media link" }).fill(second);
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  const preview = page.getByRole("img", { name: "Generated WaveCode preview" });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".data-upper")).toHaveCount(28);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const file = await download.path();
  if (!file) throw new Error("Apple Music generic Dual PNG is missing.");
  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "apple-dual-overlap.png",
    mimeType: "image/png",
    buffer: readFileSync(file),
  });
  await expect(page.getByText("DUAL CODE FOUND")).toBeVisible({ timeout: 70_000 });
  const links = page.getByRole("link", { name: "Open Apple Music" });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", first);
  await expect(links.nth(1)).toHaveAttribute("href", second);
});

test("adaptive V2 Dual reduces two numeric IDs to seventeen real optical columns", async ({ page }) => {
  const first = "https://www.deezer.com/track/12345";
  const second = "https://tidal.com/browse/track/67890";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" }).fill(first);
  await page.getByRole("textbox", { name: "Second media link" }).fill(second);
  await page.getByRole("button", { name: "Create WaveCode" }).click();

  const preview = page.getByRole("img", { name: "Generated WaveCode preview" });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".w-capsule")).toHaveCount(22);
  await expect(preview.locator(".data-upper")).toHaveCount(17);
  await expect(preview.locator(".data-lower")).toHaveCount(17);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Compact numeric V2 Dual PNG was not downloaded.");

  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "numeric-dual-v2.png",
    mimeType: "image/png",
    buffer: readFileSync(path),
  });
  await expect(page.getByText("DUAL CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expect(page.getByRole("link", { name: "Open Deezer" }))
    .toHaveAttribute("href", first);
  await expect(page.getByRole("link", { name: "Open TIDAL" }))
    .toHaveAttribute("href", second);
});
