import { expect, test } from "@playwright/test";

const track = "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b";

async function renderCode(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Create" }).click();
  await page.getByLabel("Music or video link").fill(track);
  await page.getByRole("button", { name: "Create WaveCode" }).click();
  const preview = page.getByRole("img", { name: "Generated WaveCode preview" });
  await expect(preview).toBeVisible();
  return preview;
}

test("transparent native SVG contains exactly the 72 official WaveCode rails", async ({ page }, testInfo) => {
  const preview = await renderCode(page);

  await expect(preview.locator("rect")).toHaveCount(72);
  await expect(preview.locator("image, foreignObject, canvas")).toHaveCount(0);
  await expect(page.locator(".output-panel img")).toHaveCount(0);
  await expect(page.locator(".output-stage")).toHaveCount(0);

  const geometry = await preview.evaluate((svg) => ({
    viewBox: svg.getAttribute("viewBox"),
    background: getComputedStyle(svg).backgroundColor,
    fill: getComputedStyle(svg.querySelector("rect")!).fill,
    color: getComputedStyle(svg).color,
  }));

  expect(geometry.viewBox).toBe("0 0 960.000000 240.000000");
  expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
  expect(geometry.fill).toBe(geometry.color);

  if (testInfo.project.name === "mobile-chromium") {
    await page.screenshot({ path: "test-results/vector-preview-light.png", fullPage: true });
  }
});

test("preview adapts to dark mode and theme-extension foreground overrides", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const preview = await renderCode(page);

  const colors = await preview.evaluate((svg) => {
    const firstBar = svg.querySelector("rect")!;
    return {
      ink: getComputedStyle(firstBar).fill,
      foreground: getComputedStyle(svg).color,
      background: getComputedStyle(svg).backgroundColor,
      pageBackground: getComputedStyle(document.querySelector(".app-wrapper")!).backgroundColor,
    };
  });

  expect(colors.ink).toBe(colors.foreground);
  expect(colors.foreground).not.toBe("rgb(17, 17, 17)");
  expect(colors.background).toBe("rgba(0, 0, 0, 0)");
  expect(colors.pageBackground).toBe("rgb(23, 23, 22)");

  if (testInfo.project.name === "mobile-chromium") {
    await page.screenshot({ path: "test-results/vector-preview-dark.png", fullPage: true });
  }

  await page.addStyleTag({ content: `.output-panel { color: rgb(235, 235, 235) !important; background-color: rgb(10, 10, 10) !important; }` });

  const updated = await preview.evaluate((svg) => ({
    ink: getComputedStyle(svg.querySelector("rect")!).fill,
    inheritedColor: getComputedStyle(svg).color,
    background: getComputedStyle(svg).backgroundColor,
  }));

  expect(updated.ink).toBe("rgb(235, 235, 235)");
  expect(updated.ink).toBe(updated.inheritedColor);
  expect(updated.background).toBe("rgba(0, 0, 0, 0)");
});

test("code preview survives a live light/dark preference change", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const preview = await renderCode(page);
  const originalFill = await preview.locator("rect").first().evaluate((rect) => getComputedStyle(rect).fill);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(preview).toBeVisible();
  await expect(preview.locator("rect")).toHaveCount(72);

  const newFill = await preview.locator("rect").first().evaluate((rect) => getComputedStyle(rect).fill);
  expect(newFill).not.toBe(originalFill);
});
