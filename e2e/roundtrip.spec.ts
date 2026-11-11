import { expect, test } from "@playwright/test";

const TRACK = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";
const EXPECTED = TRACK + "?t=59";

test("generate, download and decode the same WaveCode entirely in the browser", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the music/ })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await navigation.getByRole("button", { name: /Create/ }).click();

  await expect(page.getByRole("heading", { name: /Make it yours/ })).toBeVisible();
  await page.getByRole("textbox", { name: "Track link" }).fill(TRACK);
  await page.getByRole("textbox", { name: "Start at a moment" }).fill("00:59");
  await page.getByRole("button", { name: "Create WaveCode" }).click();

  await expect(page.getByAltText("Generated 36-column WaveCode with capsule-shaped rails")).toBeVisible();
  await expect(page.getByText(/Your WaveCode is ready/)).toBeVisible();
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
  await page.locator('input[type="file"]').setInputFiles(filepath);
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
