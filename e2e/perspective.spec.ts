import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const TRACK = "https://open.spotify.com/track/0123456789abcdefghijkl";

test("existing V1 marks survive combined camera roll and perspective in WASM", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Create" }).click();
  await page.getByLabel("Track link").fill(TRACK);
  await page.getByRole("button", { name: "Create WaveCode" }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("WaveCode image export failed.");

  const photo = await page.evaluate(async (bytes: number[]) => {
    const source = new Image();
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    try {
      await new Promise<void>((resolve, reject) => {
        source.onload = () => resolve();
        source.onerror = () => reject(new Error("Invalid source image"));
        source.src = url;
      });

      const input = document.createElement("canvas");
      input.width = 960;
      input.height = 240;
      const src = input.getContext("2d")!;
      src.drawImage(source, 0, 0, input.width, input.height);
      const original = src.getImageData(0, 0, input.width, input.height);

      const output = document.createElement("canvas");
      output.width = 1600;
      output.height = 1180;
      const ctx = output.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, output.width, output.height);
      const warped = ctx.getImageData(0, 0, output.width, output.height);

      const roll = 0.60;
      const perspective = 0.48;
      const cosine = Math.cos(roll);
      const sine = Math.sin(roll);

      for (let y = 0; y < output.height; y++) {
        for (let x = 0; x < output.width; x++) {
          const dx = x - output.width / 2;
          const dy = y - output.height / 2;

          const localX = 720 + dx * cosine + dy * sine;
          const localY = 290 - dx * sine + dy * cosine;

          const projectedX = localX - 200;
          const projectedY = localY - 170;
          const denominator = 1 - perspective * projectedX / input.width;
          if (denominator <= 0) continue;

          const sx = Math.round(projectedX / denominator);
          const sy = Math.round(input.height / 2 +
            (projectedY - input.height / 2) / denominator);
          if (sx < 0 || sy < 0 || sx >= input.width || sy >= input.height) continue;

          const sourceIndex = (sy * input.width + sx) * 4;
          const targetIndex = (y * output.width + x) * 4;
          const tone = original.data[sourceIndex]!;
          warped.data[targetIndex] = tone;
          warped.data[targetIndex + 1] = tone;
          warped.data[targetIndex + 2] = tone;
        }
      }

      ctx.putImageData(warped, 0, 0);
      const result = await new Promise<Blob>((resolve, reject) => {
        output.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not export image")), "image/png");
      });
      return Array.from(new Uint8Array(await result.arrayBuffer()));
    } finally {
      URL.revokeObjectURL(url);
    }
  }, Array.from(readFileSync(path)));

  await page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "oblique-legacy-v1.png",
    mimeType: "image/png",
    buffer: Buffer.from(photo),
  });

  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole("link", { name: "Open track" }))
    .toHaveAttribute("href", TRACK);
});
