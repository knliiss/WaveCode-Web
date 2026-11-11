import { describe, expect, it } from "vitest";
import { captureArea } from "../src/infrastructure/camera/frames";

describe("adaptive camera capture", () => {
  it("keeps the optical center on different aspect ratios", () => {
    for (const [w, h] of ([[1920, 1080], [1080, 1920], [1280, 720], [640, 480]] as const)) {
      for (const mode of ["finder", "detail", "full"] as const) {
        const area = captureArea(w, h, mode);
        expect(area.sx + area.sw / 2).toBeCloseTo(w / 2, 0);
        expect(area.sy + area.sh / 2).toBeCloseTo(h / 2, 0);
        expect(area.width).toBeGreaterThan(0);
        expect(area.height).toBeGreaterThan(0);
        expect(Math.max(area.width, area.height)).toBeLessThanOrEqual(1600);
      }
    }
  });
  it("does not upscale low resolution sensor frames", () => {
    expect(captureArea(320, 240, "full").width).toBe(320);
  });
  it("rejects a camera without usable dimensions", () => {
    expect(() => captureArea(0, 0, "finder")).toThrow();
  });
});
