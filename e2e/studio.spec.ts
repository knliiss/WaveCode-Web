import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const hit = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";

test("a real WaveCode can be created, downloaded and scanned on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the music/i })).toBeVisible();
  await page.screenshot({ path: "test-results/scan-mobile.png", fullPage: true });

  await page.getByRole("button", { name: /Create 02/i }).click();
  await expect(page.getByRole("heading", { name: /Make it yours/i })).toBeVisible();
  await page.getByLabel("Track link").fill(hit);
  await page.getByLabel("Start at a moment").fill("00:59");
  await page.getByRole("button", { name: /Create WaveCode/i }).click();

  await expect(page.getByAltText("Generated 36-column WaveCode with capsule-shaped rails")).toBeVisible();
  await expect(page.getByText(/Your WaveCode is ready/)).toBeVisible();
  await page.screenshot({ path: "test-results/create-mobile.png", fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /PNG/ }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByRole("button", { name: /Scan 01/i }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "wavecode.png",
    mimeType: "image/png",
    buffer: readFileSync(path!),
  });
  await expect(page.getByRole("heading", { name: /There's your music/i })).toBeVisible();
  const open = page.getByRole("link", { name: /Open track/i });
  await expect(open).toHaveAttribute("href", hit + "?t=59");
});

test("mobile camera starts and can be stopped without leaving active media", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-webkit", "Virtual camera behavior differs from physical iOS Safari.");
  await context.grantPermissions(["camera"]);
  await page.goto("/");
  await page.getByRole("button", { name: /Open camera/i }).click();
  await expect(page.getByText("LIVE CAPTURE")).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Stop camera" }).click();
  await expect(page.getByText("CAMERA OFF")).toBeVisible();
});
