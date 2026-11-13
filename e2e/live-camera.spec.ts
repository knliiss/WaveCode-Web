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
  if (!path) throw new Error("No generated WaveCode PNG.");
  return readFileSync(path);
}

async function installClutteredCamera(page: Page, mark: Buffer, width: number): Promise<void> {
  await page.evaluate(async ({ bytes, width }) => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not load camera fixture."));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d")!;
      const height = width * image.naturalHeight / image.naturalWidth;
      const draw = () => {
        context.fillStyle = "#eee";
        context.fillRect(0, 0, 1280, 720);
        context.fillStyle = "#303030";
        for (let x = 60; x < 1220; x += 33) {
          context.fillRect(x, 150, 6, 18);
          context.fillRect(x, 540, 6, 18);
        }
        context.drawImage(image, (1280 - width) / 2, (720 - height) / 2, width, height);
      };
      draw();
      const stream = canvas.captureStream(15);
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => stream,
      });
      window.setInterval(draw, 130);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, { bytes: Array.from(mark), width });
}

for (const dual of [false, true]) {
  test(`live mobile camera scans a cluttered photo containing V2 ${dual ? "Dual" : "Single"}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile-chromium", "Canvas camera capture only exercised in Chromium.");
    await page.goto("/");
    const mark = await createMark(page, dual);
    await installClutteredCamera(page, mark, dual ? 400 : 460);

    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await nav.getByRole("button", { name: "Scan" }).click();
    await page.getByRole("button", { name: "Open camera" }).click();

    await expect(page.getByText(dual ? "DUAL CODE FOUND" : "CODE FOUND"))
      .toBeVisible({ timeout: 65_000 });
    await expect(page.locator(".result-version")).toHaveText("V2");
    if (dual) {
      await expect(page.getByRole("link", { name: "Open Deezer" })).toHaveAttribute("href", DEEZER);
      await expect(page.getByRole("link", { name: "Open TIDAL" })).toHaveAttribute("href", TIDAL);
    } else {
      await expect(page.getByRole("link", { name: "Open track" })).toHaveAttribute("href", SPOTIFY);
    }
  });
}
