import { expect, test } from "@playwright/test";

test.skip(({ browserName }) => browserName === "webkit", "Physical iOS camera capability support varies.");

test("supported cameras offer reversible low-glare exposure without changing the scanning flow", async ({ page, context }) => {
  await context.grantPermissions(["camera"]);

  await page.addInitScript(() => {
    const originalCapabilities = MediaStreamTrack.prototype.getCapabilities;
    const originalSettings = MediaStreamTrack.prototype.getSettings;
    const originalApply = MediaStreamTrack.prototype.applyConstraints;
    MediaStreamTrack.prototype.getCapabilities = function () {
      return {
        ...originalCapabilities.call(this),
        exposureCompensation: { min: -3, max: 3, step: 0.5 },
      };
    };
    MediaStreamTrack.prototype.getSettings = function () {
      return { ...originalSettings.call(this), exposureCompensation: 0 };
    };
    MediaStreamTrack.prototype.applyConstraints = function (constraints) {
      const advanced = constraints.advanced?.[0] as { exposureCompensation?: number } | undefined;
      if (typeof advanced?.exposureCompensation === "number") {
        const state = window as Window & { cameraExposureChanges?: number[] };
        state.cameraExposureChanges = [
          ...(state.cameraExposureChanges ?? []), advanced.exposureCompensation,
        ];
        return Promise.resolve();
      }
      return originalApply.call(this, constraints);
    };
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Open camera" }).click();
  const reduce = page.getByRole("button", { name: "Reduce camera exposure" });
  await expect(reduce).toBeVisible({ timeout: 40_000 });
  await reduce.click();
  await expect(page.getByRole("button", { name: "Restore camera exposure" })).toBeVisible();
  await page.getByRole("button", { name: "Restore camera exposure" }).click();
  await expect(reduce).toBeVisible();

  const levels = await page.evaluate(() =>
    (window as Window & { cameraExposureChanges?: number[] }).cameraExposureChanges,
  );
  expect(levels).toEqual([-1, 0]);

  await page.getByRole("button", { name: "Stop camera" }).click();
  await expect(reduce).toHaveCount(0);
});
