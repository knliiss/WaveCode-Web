interface NumericRange {
  min: number;
  max: number;
  step?: number;
}

export interface ExposureCapabilities {
  exposureCompensation?: NumericRange;
}

export interface ExposureSettings {
  exposureCompensation?: number;
}

export interface ExposurePlan {
  baseline: number;
  reduced: number;
}

export function planExposureReduction(
  capabilities: ExposureCapabilities | undefined,
  settings: ExposureSettings | undefined,
): ExposurePlan | null {
  const range = capabilities?.exposureCompensation;
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max) ||
    range.min >= 0 || range.max < 0 || range.min >= range.max) return null;

  const raw = settings?.exposureCompensation;
  const baseline = typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(range.min, Math.min(range.max, raw))
    : 0;
  const target = Math.max(range.min, baseline - 0.85);
  const step = range.step;

  const reduced = typeof step === "number" && Number.isFinite(step) && step > 0
    ? Math.max(range.min, Math.min(range.max,
      range.min + Math.round((target - range.min) / step) * step))
    : target;

  if (baseline - reduced < 0.1) return null;
  return { baseline, reduced };
}

interface CameraAdjustment extends MediaTrackConstraintSet {
  torch?: boolean;
  exposureCompensation?: number;
}

export function applyCameraAdjustments(
  track: MediaStreamTrack,
  options: { torch?: boolean; exposureCompensation?: number },
): Promise<void> {
  return track.applyConstraints({
    advanced: [{ ...options } as CameraAdjustment],
  });
}
