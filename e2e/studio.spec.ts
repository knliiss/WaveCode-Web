import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const hit = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";

test("a real WaveCode can be created, downloaded and scanned on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the moment/i })).toBeVisible();
  await page.screenshot({ path: "test-results/scan-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: /Make it yours/i })).toBeVisible();
  await page.getByLabel("Music or video link").fill(hit);
  await page.getByLabel("Start at a moment").fill("00:59");
  await page.getByRole("button", { name: /Create WaveCode/i }).click();

  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy WaveCode image" })).toBeVisible();
  await page.screenshot({ path: "test-results/create-mobile.png", fullPage: true });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /PNG/ }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.getByRole("button", { name: "Scan" }).click();
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
  await expect(page.getByText("LIVE", { exact: true })).toBeVisible({ timeout: 40_000 });
  await page.getByRole("button", { name: "Stop camera" }).click();
  await expect(page.getByRole("button", { name: "Open camera" })).toBeVisible();
});

test("mobile clipboard copies PNG pixels, resets its button and avoids input zoom", async ({ page }) => {
  await page.addInitScript(() => {
    class TestClipboardItem {
      constructor(private readonly representations: Record<string, Blob>) {}
      getType(type: string): Promise<Blob> {
        return Promise.resolve(this.representations[type]);
      }
    }
    const record = window as Window & {
      copiedWaveCode?: { count: number; signature: number[]; type: string; size: number };
    };
    Object.defineProperty(window, "ClipboardItem", {
      value: TestClipboardItem,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "",
        write: async (items: TestClipboardItem[]) => {
          const image = await items[0]!.getType("image/png");
          const bytes = new Uint8Array(await image.arrayBuffer());
          record.copiedWaveCode = {
            count: (record.copiedWaveCode?.count ?? 0) + 1,
            signature: Array.from(bytes.slice(0, 8)),
            type: image.type,
            size: image.size,
          };
        },
      },
    });
  });

  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Try an example")).toHaveCount(0);

  for (const selector of ["#track-link", "#track-moment"]) {
    const fontSize = await page.locator(selector).evaluate((input) =>
      Number.parseFloat(getComputedStyle(input).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  }

  await page.getByLabel("Music or video link").fill(hit);
  await page.getByRole("button", { name: "Create WaveCode" }).click();

  const copy = page.getByRole("button", { name: "Copy WaveCode image" });
  await expect(copy).toBeVisible();
  await copy.click();
  await expect(page.getByRole("button", { name: "Image copied" })).toBeVisible();

  const copied = await page.evaluate(() =>
    (window as Window & {
      copiedWaveCode?: { count: number; signature: number[]; type: string; size: number };
    }).copiedWaveCode,
  );
  expect(copied).toMatchObject({
    count: 1,
    signature: [137, 80, 78, 71, 13, 10, 26, 10],
    type: "image/png",
  });
  expect(copied?.size).toBeGreaterThan(100);

  await expect(copy).toBeVisible({ timeout: 5_000 });
  await copy.click();
  await expect(page.getByRole("button", { name: "Image copied" })).toBeVisible();
  const count = await page.evaluate(() =>
    (window as Window & { copiedWaveCode?: { count: number } }).copiedWaveCode?.count,
  );
  expect(count).toBe(2);
});
