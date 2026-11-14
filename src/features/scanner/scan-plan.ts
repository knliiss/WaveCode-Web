import type { ScanMode } from "../../domain/wavecode";
import type { CaptureMode } from "../../infrastructure/camera/frames";

const perspectiveCandidates = 12;
const candidatesPerFrame = 2;

export interface CameraScanStep {
  captureMode: CaptureMode;
  scanMode: ScanMode;
  candidate: number;
  nextCandidate: number;
}

// Prioritize fast, detail-preserving crops. The previous scheduler always
// selected "full" for its perspective frames and almost never selected
// "finder" for ordinary V2, downscaling small optical rails unnecessarily.
// Expensive W geometry is intentionally periodic, not repeated every frame.
const scanCycle: ReadonlyArray<{ captureMode: CaptureMode; scanMode: ScanMode }> = [
  { scanMode: "all", captureMode: "full" },
  { scanMode: "v2", captureMode: "finder" },
  { scanMode: "v2-perspective", captureMode: "full" },
  { scanMode: "v2", captureMode: "detail" },
  { scanMode: "v2-perspective", captureMode: "finder" },
  { scanMode: "v2", captureMode: "full" },
  { scanMode: "v2-perspective", captureMode: "full" },
  { scanMode: "v2", captureMode: "finder" },
  { scanMode: "v2-anchor", captureMode: "full" },
  { scanMode: "v2", captureMode: "detail" },
  { scanMode: "v2-perspective", captureMode: "full" },
  { scanMode: "all", captureMode: "finder" },
  { scanMode: "v2", captureMode: "finder" },
  { scanMode: "v2-perspective", captureMode: "full" },
  { scanMode: "v2", captureMode: "detail" },
  { scanMode: "v2-perspective", captureMode: "finder" },
  { scanMode: "v2", captureMode: "full" },
  { scanMode: "v2-anchor", captureMode: "finder" },
];

export function cameraScanStep(iteration: number, nextCandidate: number): CameraScanStep {
  const step = scanCycle[iteration % scanCycle.length]!;
  const perspective = step.scanMode === "v2-perspective";
  return {
    captureMode: step.captureMode,
    scanMode: step.scanMode,
    candidate: perspective ? nextCandidate : 0,
    nextCandidate: perspective
      ? (nextCandidate + candidatesPerFrame) % perspectiveCandidates
      : nextCandidate,
  };
}
