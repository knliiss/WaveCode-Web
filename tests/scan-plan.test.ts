import { describe, expect, it } from "vitest";
import { cameraScanStep } from "../src/features/scanner/scan-plan";

describe("camera perspective scheduling", () => {
  it("checks opposite yaw candidates in the very first camera frame", () => {
    const first = cameraScanStep(0, 0);
    expect(first).toEqual({
      captureMode: "full",
      scanMode: "v2-oblique",
      candidate: 0,
      nextCandidate: 2,
    });
    const second = cameraScanStep(1, first.nextCandidate);
    expect(second.scanMode).toBe("v2-oblique");
    expect(second.candidate).toBe(2);
  });

  it("checks all twelve perspective candidates without starving V1", () => {
    const starts: number[] = [];
    let nextCandidate = 0;
    let checkedLegacy = false;
    let checkedCrop = false;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const step = cameraScanStep(iteration, nextCandidate);
      nextCandidate = step.nextCandidate;
      if (step.scanMode === "v2-oblique") starts.push(step.candidate);
      if (step.scanMode === "all") checkedLegacy = true;
      if (step.scanMode === "v2" && step.captureMode !== "full") checkedCrop = true;
    }
    expect(starts.slice(0, 6)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(checkedLegacy).toBe(true);
    expect(checkedCrop).toBe(true);
  });
});
