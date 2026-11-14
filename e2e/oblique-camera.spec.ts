import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const SPOTIFY = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";
const DEEZER = "https://www.deezer.com/track/12345";
const TIDAL = "https://tidal.com/browse/track/67890";

async function createMark(page: Page, dual: boolean): Promise<Buffer> {
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  if (dual) {
    await page.getByRole("button", { name: "Dual link" }).click();
    await page.getByRole("textbox", { name: "First media link" }).fill(DEEZER);
    await page.getByRole("textbox", { name: "Second media link" }).fill(TIDAL);
  } else {
    await page.getByRole("textbox", { name: "Music or video link" }).fill(SPOTIFY);
  }
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("WaveCode download not found.");
  return readFileSync(path);
}

async function installAngledCamera(
  page: Page,
  mark: Buffer,
  yaw: number,
  tilt: number,
): Promise<void> {
  await page.evaluate(async ({ bytes, yaw, tilt }) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Invalid exported WaveCode."));
        image.src = url;
      });
      const source = document.createElement("canvas");
      source.width = 1280;
      source.height = 720;
      const ctx = source.getContext("2d")!;
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = "#303030";
      for (let x = 60; x < 1220; x += 33) {
        ctx.fillRect(x, 65, 6, 18);
        ctx.fillRect(x, 625, 6, 18);
      }
      const codeWidth = 690;
      const codeHeight = codeWidth * image.naturalHeight / image.naturalWidth;
      ctx.drawImage(image, (1280 - codeWidth) / 2, (720 - codeHeight) / 2, codeWidth, codeHeight);
      const pixels = ctx.getImageData(0, 0, 1280, 720);
      const result = ctx.createImageData(1280, 720);
      const cx = 640;
      const cy = 360;
      const valueAt = (x: number, y: number) =>
        pixels.data[(y * 1280 + x) * 4]!;
      for (let y = 0; y < 720; y++) {
        for (let x = 0; x < 1280; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const divisor = 1 - yaw * dx / 1280;
          const sx = cx + dx / divisor;
          const sy = cy + (dy - tilt * dx) / divisor;
          let value = 242;
          if (sx >= 0 && sy >= 0 && sx < 1279 && sy < 719) {
            const ix = Math.floor(sx);
            const iy = Math.floor(sy);
            const fx = sx - ix;
            const fy = sy - iy;
            const top = valueAt(ix, iy) * (1 - fx) + valueAt(ix + 1, iy) * fx;
            const bottom = valueAt(ix, iy + 1) * (1 - fx) +
              valueAt(ix + 1, iy + 1) * fx;
            value = Math.round(top * (1 - fy) + bottom * fy);
          }
          const offset = (y * 1280 + x) * 4;
          result.data[offset] = value;
          result.data[offset + 1] = value;
          result.data[offset + 2] = value;
          result.data[offset + 3] = 255;
        }
      }
      const camera = document.createElement("canvas");
      camera.width = 1280;
      camera.height = 720;
      const cameraContext = camera.getContext("2d")!;
      const draw = () => cameraContext.putImageData(result, 0, 0);
      draw();
      const stream = camera.captureStream(15);
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => stream,
      });
      window.setInterval(draw, 120);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, { bytes: Array.from(mark), yaw, tilt });
}

for (const fixture of [
  { dual: false, yaw: 0.65, tilt: 0.18 },
  { dual: true, yaw: -0.65, tilt: -0.18 },
]) {
  test(`angled camera finds V2 ${fixture.dual ? "Dual" : "Single"} with perspective`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile-chromium", "Camera MediaStream injection is Chromium-only.");
    await page.goto("/");
    const mark = await createMark(page, fixture.dual);
    await installAngledCamera(page, mark, fixture.yaw, fixture.tilt);
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await nav.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("button", { name: "Open camera" }).click();

    await expect(page.getByText(fixture.dual ? "DUAL CODE FOUND" : "CODE FOUND"))
      .toBeVisible({ timeout: 75_000 });
    await expect(page.locator(".result-version")).toHaveText("V2");
    if (fixture.dual) {
      await expect(page.getByRole("link", { name: "Open Deezer" })).toHaveAttribute("href", DEEZER);
      await expect(page.getByRole("link", { name: "Open TIDAL" })).toHaveAttribute("href", TIDAL);
    } else {
      await expect(page.getByRole("link", { name: "Open track" })).toHaveAttribute("href", SPOTIFY);
    }
  });
}
