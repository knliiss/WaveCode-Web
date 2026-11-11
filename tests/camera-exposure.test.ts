import { describe, expect, it, vi } from "vitest";
import { applyCameraAdjustments, planExposureReduction } from "../src/infrastructure/camera/exposure";

describe("optional glare reduction via camera exposure", () => {
  it("hides unsupported camera controls rather than inventing exposure adjustment", () => {
    expect(planExposureReduction(undefined, undefined)).toBeNull();
    expect(planExposureReduction({}, {})).toBeNull();
    expect(planExposureReduction({ exposureCompensation: { min: 0, max: 3 } }, {})).toBeNull();
    expect(planExposureReduction({ exposureCompensation: { min: -2, max: 2 } },
      { exposureCompensation: -2 })).toBeNull();
  });

  it("respects camera steps, range and current compensation", () => {
    expect(planExposureReduction(
      { exposureCompensation: { min: -3, max: 3, step: 0.5 } },
      { exposureCompensation: 0 },
    )).toEqual({ baseline: 0, reduced: -1 });
    expect(planExposureReduction(
      { exposureCompensation: { min: -0.5, max: 2, step: 0.5 } },
      {},
    )).toEqual({ baseline: 0, reduced: -0.5 });
  });

  it("sends exposure and flashlight controls together without losing the other setting", async () => {
    const applyConstraints = vi.fn(async (_constraints: MediaTrackConstraints) => {});
    const track = { applyConstraints } as unknown as MediaStreamTrack;

    await applyCameraAdjustments(track, { torch: true, exposureCompensation: -1 });
    expect(applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true, exposureCompensation: -1 }],
    });
  });
});
