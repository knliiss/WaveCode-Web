import { expect, test } from "@playwright/test";
import { createLegacyV1Png } from "./legacy-v1";

const TRACK = "https://open.spotify.com/track/0123456789abcdefghijkl";

for (const lightInk of [false, true]) {
  test(`V1 WASM reads ${lightInk ? "light" : "dark"} rails across a strong illumination gradient`, async ({ page }) => {
    await page.goto("/");
    const legacy = await createLegacyV1Png(page, TRACK);

    const photo = await page.evaluate(async ({ bytes, inkIsLight }: { bytes: number[]; inkIsLight: boolean }) => {
      const source = new Image();
      const sourceUrl = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      try {
        await new Promise<void>((resolve, reject) => {
          source.onload = () => resolve();
          source.onerror = () => reject(new Error("Invalid exported PNG"));
          source.src = sourceUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(source, 0, 0);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const index = (y * canvas.width + x) * 4;
            const gradient = 42 + Math.floor(x * 155 / canvas.width);
            const dx = x - canvas.width / 2;
            const dy = y - canvas.height * 0.15;
            const glare = dx * dx * 3 + dy * dy * 10 < (canvas.width * 0.13) ** 2 ? 26 : 0;
            const background = Math.min(226, gradient + glare);
            const rail = frame.data[index]! < 130;
            const shade = rail
              ? inkIsLight ? Math.min(255, background + 28) : Math.max(0, background - 28)
              : background;
            frame.data[index] = shade;
            frame.data[index + 1] = shade;
            frame.data[index + 2] = shade;
            frame.data[index + 3] = 255;
          }
        }
        ctx.putImageData(frame, 0, 0);
        const result = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG conversion failed")), "image/png");
        });
        return Array.from(new Uint8Array(await result.arrayBuffer()));
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    }, { bytes: Array.from(legacy), inkIsLight: lightInk });

    await page.getByRole("navigation", { name: "Primary navigation" })
      .getByRole("button", { name: "Scan" }).click();
    await page.getByLabel("Choose a WaveCode photo").setInputFiles({
      name: "uneven-light.png",
      mimeType: "image/png",
      buffer: Buffer.from(photo),
    });

    await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
    await expect(page.getByRole("link", { name: "Open track" }))
      .toHaveAttribute("href", TRACK);
  });
}
