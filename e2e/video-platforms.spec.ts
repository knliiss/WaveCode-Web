import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const cases = [
  {
    name: "YouTube video with moment",
    input: "https://www.youtube.com/watch?v=JGwWNGJdvx8",
    moment: "01:35",
    output: "https://www.youtube.com/watch?v=JGwWNGJdvx8&t=95",
    label: "YouTube",
  },
  {
    name: "YouTube Shorts native view",
    input: "https://www.youtube.com/shorts/JGwWNGJdvx8",
    moment: "",
    output: "https://www.youtube.com/shorts/JGwWNGJdvx8",
    label: "YouTube Shorts",
  },
  {
    name: "timed Short opens in the original YouTube watch player",
    input: "https://www.youtube.com/shorts/JGwWNGJdvx8",
    moment: "35",
    output: "https://www.youtube.com/watch?v=JGwWNGJdvx8&t=35",
    label: "YouTube",
  },
  {
    name: "TikTok opens the platform URL without a player",
    input: "https://www.tiktok.com/@creator/video/7300873037530795272",
    moment: null,
    output: "https://www.tiktok.com/@/video/7300873037530795272",
    label: "TikTok",
  },
  {
    name: "TikTok short share link survives offline encoding",
    input: "https://vt.tiktok.com/ZSp94BeDn/",
    moment: null,
    output: "https://vt.tiktok.com/ZSp94BeDn/",
    label: "TikTok",
  },
  {
    name: "Instagram Reel opens native platform URL",
    input: "https://www.instagram.com/reel/DIPPWkUh7Rj/",
    moment: null,
    output: "https://www.instagram.com/reel/DIPPWkUh7Rj/",
    label: "Instagram Reels",
  },
] as const;

for (const item of cases) {
  test(`V1 video round trip: ${item.name}`, async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await nav.getByRole("button", { name: "Create" }).click();
    await page.getByLabel("Music or video link").fill(item.input);

    const momentInput = page.getByRole("textbox", { name: "Start at a moment" });
    if (item.moment === null) {
      await expect(momentInput).toHaveCount(0);
    } else {
      await expect(momentInput).toBeVisible();
      if (item.moment) await momentInput.fill(item.moment);
    }

    await page.getByRole("button", { name: "Create WaveCode" }).click();
    await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Save PNG" }).click(),
    ]);
    const pngPath = await download.path();
    if (!pngPath) throw new Error("No video WaveCode PNG was exported.");

    await nav.getByRole("button", { name: "Scan" }).click();
    await page.getByLabel("Choose a WaveCode photo").setInputFiles({
      name: "video-wavecode.png",
      mimeType: "image/png",
      buffer: readFileSync(pngPath),
    });

    await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
    await expect(page.getByRole("link", { name: "Open video" }))
      .toHaveAttribute("href", item.output);
    await expect(page.getByText(item.label, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open video" }))
      .toHaveAttribute("target", "_blank");
  });
}

test("V2 short TikTok share URL is lossless without resolving redirects", async ({ page }) => {
  const link = "https://vt.tiktok.com/ZSp94BeDn/";
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "V2 · single" }).click();
  await page.getByRole("textbox", { name: "Music or video link" }).fill(link);
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  await expect(page.getByRole("img", { name: "Generated WaveCode preview" })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save PNG" }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("No V2 TikTok WaveCode PNG was exported.");

  await nav.getByRole("button", { name: "Scan" }).click();
  await page.getByLabel("Choose a WaveCode photo").setInputFiles({
    name: "tiktok-v2.png",
    mimeType: "image/png",
    buffer: readFileSync(path),
  });
  await expect(page.getByText("CODE FOUND")).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole("link", { name: "Open video" })).toHaveAttribute("href", link);
  await expect(page.locator(".result-version")).toHaveText("V2");
  await expect(page.locator('.result-track [data-platform="tiktok"]')).toHaveCount(1);
});
