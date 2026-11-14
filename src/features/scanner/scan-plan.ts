import type { ScanMode } from "../../domain/wavecode";
import type { CaptureMode } from "../../infrastructure/camera/frames";

const captureModes: readonly CaptureMode[] = [
  "finder", "detail", "finder", "full",
  "lower", "finder", "upper", "full",
  "left", "finder", "right", "detail",
];

const perspectiveCandidates = 12;
const candidatesPerFrame = 2;

export interface CameraScanStep {
  captureMode: CaptureMode;
  scanMode: ScanMode;
  candidate: number;
  nextCandidate: number;
}

export function cameraScanStep(iteration: number, nextCandidate: number): CameraScanStep {
  const scanMode: ScanMode = iteration % 9 === 8 ? "all"
    : iteration % 4 === 3 ? "v2" : "v2-oblique";
  const oblique = scanMode === "v2-oblique";
  return {
    captureMode: oblique ? "full" : captureModes[iteration % captureModes.length]!,
    scanMode,
    candidate: oblique ? nextCandidate : 0,
    nextCandidate: oblique
      ? (nextCandidate + candidatesPerFrame) % perspectiveCandidates
      : nextCandidate,
  };
}
