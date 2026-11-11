import { describe, expect, it } from "vitest";
import { captureArea, photoScanAreas } from "../src/infrastructure/camera/frames";

describe("adaptive camera capture", () => {
  it("keeps the optical center on different aspect ratios", () => {
    for (const [w, h] of ([[1920, 1080], [1080, 1920], [1280, 720], [640, 480]] as const)) {
      for (const mode of ["finder", "detail", "full"] as const) {
        const area = captureArea(w, h, mode);
        expect(Math.abs(area.sx + area.sw / 2 - w / 2)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(area.sy + area.sh / 2 - h / 2)).toBeLessThanOrEqual(0.5);
        expect(area.width).toBeGreaterThan(0);
        expect(area.height).toBeGreaterThan(0);
        expect(Math.max(area.width, area.height)).toBeLessThanOrEqual(1600);
      }
    }
  });
  it("aligns finder capture with an object-cover portrait view", () => {
    const area = captureArea(1920, 1080, "finder", 360, 430);
    expect(area.sw).toBeLessThan(1000);
    expect(area.sx).toBeGreaterThan(400);
  });
  it("does not upscale low resolution sensor frames", () => {
    expect(captureArea(320, 240, "full").width).toBe(320);
  });
  it("rejects a camera without usable dimensions", () => {
    expect(() => captureArea(0, 0, "finder")).toThrow();
  });
});

describe("high-detail image scanning", () => {
  it("covers large photos with overlapping crops while keeping each pass under decoder limits", () => {
    const photoWidth = 8064;
    const photoHeight = 6048;
    const areas = photoScanAreas(photoWidth, photoHeight);
    expect(areas).toHaveLength(7);
    expect(areas[0]?.sx).toBe(0);
    expect(areas[0]?.sw).toBe(photoWidth);
    for (const area of areas) {
      expect(area.width * area.height).toBeLessThanOrEqual(20_000_000);
      expect(Math.max(area.width, area.height)).toBeLessThanOrEqual(2600);
      expect(area.sx).toBeGreaterThanOrEqual(0);
      expect(area.sy).toBeGreaterThanOrEqual(0);
      expect(area.sx + area.sw).toBeLessThanOrEqual(photoWidth);
      expect(area.sy + area.sh).toBeLessThanOrEqual(photoHeight);
    }
  });

  it("avoids wasted high-detail and tile passes for small input images", () => {
    const areas = photoScanAreas(900, 600);
    expect(areas).toHaveLength(1);
    expect(areas[0]?.width).toBe(900);
    expect(() => photoScanAreas(0, 200)).toThrow();
  });
});
