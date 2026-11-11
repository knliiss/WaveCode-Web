import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const TRACK = "https://open.spotify.com/track/0123456789abcdefghijkl";

test("a rotated, light-on-dark physical-style tag with nearby decoration still scans", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Create" }).click();
  await page.getByLabel("Track link").fill(TRACK);
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("button", { name: "Copy WaveCode image" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("No exported WaveCode PNG available.");

  const photo = await page.evaluate(async (bytes: number[]) => {
    const source = new Image();
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    try {
      await new Promise<void>((resolve, reject) => {
        source.onload = () => resolve();
        source.onerror = () => reject(new Error("Could not decode generated code."));
        source.src = url;
      });

      const mark = document.createElement("canvas");
      mark.width = 960;
      mark.height = 240;
      const markContext = mark.getContext("2d")!;
      markContext.drawImage(source, 0, 0);
      const pixels = markContext.getImageData(0, 0, mark.width, mark.height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        pixels.data[i] = 255 - pixels.data[i]!;
        pixels.data[i + 1] = 255 - pixels.data[i + 1]!;
        pixels.data[i + 2] = 255 - pixels.data[i + 2]!;
      }
      markContext.putImageData(pixels, 0, 0);

      const photo = document.createElement("canvas");
      photo.width = 1080;
      photo.height = 1920;
      const ctx = photo.getContext("2d")!;
      ctx.fillStyle = "#aa7d6c";
      ctx.fillRect(0, 0, photo.width, photo.height);
      ctx.fillStyle = "#be9682";
      ctx.beginPath();
      ctx.ellipse(650, 1190, 410, 720, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(475, 1180);
      ctx.rotate(1.28);
      ctx.scale(0.78, 0.95);
      ctx.fillStyle = "#111114";
      ctx.beginPath();
      ctx.roundRect(-710, -186, 1400, 372, 32);
      ctx.fill();
      ctx.drawImage(mark, -480, -120, 960, 240);

      ctx.fillStyle = "#e1dfd5";
      for (let index = 0; index < 16; index++) {
        ctx.beginPath();
        ctx.roundRect(-640 + index * 14, -20 - index % 4 * 7, 6, 20 + index % 4 * 14, 3);
        ctx.fill();
      }
      ctx.restore();

      const result = await new Promise<Blob>((resolve, reject) => {
        photo.toBlob((blob) => blob ? resolve(blob) : reject(new Error("JPEG encoding failed.")), "image/jpeg", 0.9);
      });
      return Array.from(new Uint8Array(await result.arrayBuffer()));
    } finally {
      URL.revokeObjectURL(url);
    }
  }, Array.from(readFileSync(path)));

  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "physical-tag.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(photo),
  });

  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole("link", { name: "Open track" })).toHaveAttribute("href", TRACK);
});
