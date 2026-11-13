import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function cameraStyleJpeg(
  page: Page, source: Buffer, ink: number, background: number, ratio: number,
): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ({ original, ink, background, ratio }) => {
      const sourceUrl = URL.createObjectURL(
        new Blob([new Uint8Array(original)], { type: "image/png" }),
      );
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Invalid generated WaveCode image."));
          image.src = sourceUrl;
        });
        const full = document.createElement("canvas");
        full.width = image.naturalWidth;
        full.height = image.naturalHeight;
        const originalContext = full.getContext("2d")!;
        originalContext.drawImage(image, 0, 0);
        const pixels = originalContext.getImageData(0, 0, full.width, full.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const value = pixels.data[i]! < 128 ? ink : background;
          pixels.data[i] = value;
          pixels.data[i + 1] = value;
          pixels.data[i + 2] = value;
        }
        originalContext.putImageData(pixels, 0, 0);

        const scaled = document.createElement("canvas");
        scaled.width = Math.max(1, Math.round(full.width * ratio));
        scaled.height = Math.max(1, Math.round(full.height * ratio));
        const context = scaled.getContext("2d")!;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(full, 0, 0, scaled.width, scaled.height);
        const jpeg = await new Promise<Blob>((resolve, reject) => {
          scaled.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error("Unable to encode camera JPEG.")),
            "image/jpeg", 0.96,
          );
        });
        return Array.from(new Uint8Array(await jpeg.arrayBuffer()));
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    },
    { original: Array.from(source), ink, background, ratio },
  );
  return Buffer.from(bytes);
}

async function exportPng(page: Page): Promise<Buffer> {
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("V2 PNG export failed.");
  return readFileSync(path);
}

test("V2 Single survives a faded, downscaled JPEG from a phone camera", async ({ page }) => {
  const spotify = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("textbox", { name: "Music or video link" }).fill(spotify);
  const png = await exportPng(page);
  const faded = await cameraStyleJpeg(page, png, 164, 226, 0.8);

  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "faded-camera-v2.jpg", mimeType: "image/jpeg", buffer: faded,
  });
  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expect(page.getByRole("link", { name: "Open track" }))
    .toHaveAttribute("href", spotify);
});

test("V2 compact Dual survives an underexposed JPEG with both links intact", async ({ page }) => {
  const deezer = "https://www.deezer.com/track/12345";
  const tidal = "https://tidal.com/browse/track/67890";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Dual link" }).click();
  await page.getByRole("textbox", { name: "First media link" }).fill(deezer);
  await page.getByRole("textbox", { name: "Second media link" }).fill(tidal);
  const png = await exportPng(page);
  const dim = await cameraStyleJpeg(page, png, 56, 116, 1);

  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "dim-camera-v2.jpg", mimeType: "image/jpeg", buffer: dim,
  });
  await expect(page.getByText("DUAL CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expect(page.getByRole("link", { name: "Open Deezer" }))
    .toHaveAttribute("href", deezer);
  await expect(page.getByRole("link", { name: "Open TIDAL" }))
    .toHaveAttribute("href", tidal);
});
