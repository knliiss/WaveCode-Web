import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const TRACK = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";
const EXPECTED = TRACK + "?t=59";

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
  await page.getByRole("button", { name: "V2 · dual" }).click();
  await page.getByRole("textbox", { name: "Spotify track link" }).fill(TRACK);
  await page.getByRole("textbox", { name: "YouTube Music link" })
    .fill("https://music.youtube.com/watch?v=JGwWNGJdvx8");
  await page.getByRole("textbox", { name: "Start at a moment" }).fill("00:59");

  await page.getByText("Adjust proportions").click();
  const logoSize = page.getByRole("slider", { name: "W size" });
  await logoSize.focus();
  await logoSize.press("Home");
  for (let i = 0; i < 10; i++) await logoSize.press("ArrowRight");
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
  await expect(page.getByRole("link", { name: "Open Spotify" }))
    .toHaveAttribute("href", TRACK + "?t=59");
  await expect(page.getByRole("link", { name: "Open YouTube Music" }))
    .toHaveAttribute("href", "https://music.youtube.com/watch?v=JGwWNGJdvx8&t=59");
});
