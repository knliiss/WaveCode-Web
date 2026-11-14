import { describe, expect, it } from "vitest";
import { cameraScanStep } from "../src/features/scanner/scan-plan";

describe("camera scan scheduling", () => {
  it("checks the full frame, then a high-resolution finder crop before expensive geometry", () => {
    expect(cameraScanStep(0, 0)).toEqual({
      captureMode: "full",
      scanMode: "all",
      candidate: 0,
      nextCandidate: 0,
    });
    expect(cameraScanStep(1, 0).captureMode).toBe("finder");
    expect(cameraScanStep(1, 0).scanMode).toBe("v2");
    expect(cameraScanStep(2, 0).scanMode).toBe("v2-perspective");
    expect(cameraScanStep(3, 2).captureMode).toBe("detail");
  });

  it("visits every fixed-angle candidate, retains V1, and runs W fitting sparingly", () => {
    const starts: number[] = [];
    const cropModes = new Set<string>();
    const heavyFrames: number[] = [];
    const legacyFrames: number[] = [];
    let nextCandidate = 0;
    for (let iteration = 0; iteration < 18; iteration += 1) {
      const step = cameraScanStep(iteration, nextCandidate);
      nextCandidate = step.nextCandidate;
      if (step.scanMode === "v2-perspective") starts.push(step.candidate);
      if (step.scanMode === "v2-anchor") heavyFrames.push(iteration);
      if (step.scanMode === "all") legacyFrames.push(iteration);
      if (step.scanMode === "v2") cropModes.add(step.captureMode);
    }
    expect(starts).toEqual([0, 2, 4, 6, 8, 10]);
    expect(heavyFrames).toEqual([8, 17]);
    expect(legacyFrames).toEqual([0, 11]);
    expect(cropModes).toContain("finder");
    expect(cropModes).toContain("detail");
    expect(cropModes).toContain("full");
    expect(nextCandidate).toBe(0);
  });

  it("repeats the scan cycle with stable V1 and geometry coverage", () => {
    expect(cameraScanStep(18, 0)).toEqual(cameraScanStep(0, 0));
    expect(cameraScanStep(20, 0).scanMode).toBe("v2-perspective");
  });
});
