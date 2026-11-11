import { useCallback, useEffect, useRef, useState } from "react";
import type { LocatedWaveCode, ScanSource, WaveCodeEngine } from "../../domain/wavecode";
import { isSupportedMusicUrl } from "../../domain/music-url";
import { captureFile, captureFrame, type CaptureMode } from "../../infrastructure/camera/frames";
import { originalPhotoBytes } from "../../infrastructure/camera/original-photo";

export type ScanPhase =
  | "idle" | "starting" | "scanning" | "uploading" | "found" | "error";

export interface ScanView {
  phase: ScanPhase;
  status: string;
  result: { codes: LocatedWaveCode[]; source: ScanSource } | null;
  facing: "environment" | "user";
  torchSupported: boolean;
  torchEnabled: boolean;
  attempts: number;
}

const initial: ScanView = {
  phase: "idle",
  status: "Position a WaveCode inside the frame.",
  result: null,
  facing: "environment",
  torchSupported: false,
  torchEnabled: false,
  attempts: 0,
};

function cameraMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera access is blocked. Allow camera access in your browser settings, or upload a photo.";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found. You can scan from a saved photo instead.";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "Your camera is in use by another app. Close it and try again.";
    }
  }
  return error instanceof Error ? error.message : "Could not start the camera.";
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

interface TorchConstraint extends MediaTrackConstraintSet {
  torch?: boolean;
}

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function codeCandidates(found: LocatedWaveCode[]): LocatedWaveCode[] {
  const urls = new Set<string>();
  return found.filter((code) => {
    if (!isSupportedMusicUrl(code.url) || urls.has(code.url)) return false;
    urls.add(code.url);
    return true;
  });
}

export function useScanner(engine: WaveCodeEngine, selected: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cycleRef = useRef(0);
  const isMounted = useRef(true);
  const [view, setView] = useState<ScanView>(initial);

  const releaseCamera = useCallback(() => {
    cycleRef.current += 1;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const finish = useCallback((codes: LocatedWaveCode[], source: ScanSource) => {
    if (!isMounted.current) return;
    releaseCamera();
    if (navigator.vibrate) navigator.vibrate(30);
    setView((previous) => ({
      ...previous,
      phase: "found",
      result: { codes, source },
      status: codes.length > 1 ? "Multiple WaveCodes found. Choose a result." : "WaveCode decoded.",
      torchEnabled: false,
      torchSupported: false,
    }));
  }, [releaseCamera]);

  const scanLoop = useCallback(async (cycle: number) => {
    let iteration = 0;
    while (cycleRef.current === cycle && isMounted.current) {
      if (document.visibilityState === "hidden") {
        await delay(450);
        continue;
      }
      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await delay(120);
        continue;
      }

      const started = performance.now();
      const mode: CaptureMode = iteration % 5 === 3
        ? "full"
        : iteration % 5 === 4 ? "detail" : "finder";

      try {
        const frame = await captureFrame(video, mode);
        if (cycleRef.current !== cycle) return;
        const detected = codeCandidates(await engine.scan(frame));
        if (cycleRef.current !== cycle) return;
        if (detected.length) {
          finish(detected, "camera");
          return;
        }
        iteration += 1;
        setView((previous) => ({
          ...previous,
          attempts: iteration,
          status: iteration > 10
            ? "Try moving closer or finding more even light."
            : "Looking for the two-rail WaveCode pattern…",
        }));
      } catch (error) {
        if (cycleRef.current !== cycle) return;
        if (error instanceof Error && error.message.includes("could not start")) {
          releaseCamera();
          setView((previous) => ({ ...previous, phase: "error", status: error.message }));
          return;
        }
        // A bad camera frame is recoverable. Continue with the next frame.
      }

      const elapsed = performance.now() - started;
      await delay(Math.max(85, 330 - elapsed));
    }
  }, [engine, finish, releaseCamera]);

  const start = useCallback(async (facing: "environment" | "user" = view.facing) => {
    releaseCamera();
    const cycle = cycleRef.current;
    if (!window.isSecureContext && location.hostname !== "localhost") {
      setView((previous) => ({
        ...previous, phase: "error",
        status: "Live camera access requires HTTPS. Use a secure connection or upload a photo.",
      }));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setView((previous) => ({
        ...previous, phase: "error",
        status: "Camera capture isn't supported in this browser. Upload an image instead.",
      }));
      return;
    }

    setView((previous) => ({
      ...previous,
      facing,
      phase: "starting",
      result: null,
      attempts: 0,
      status: "Preparing your camera and decoding engine…",
      torchSupported: false,
      torchEnabled: false,
    }));
    let stream: MediaStream | null = null;
    try {
      await engine.initialize();
      if (cycleRef.current !== cycle) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
        });
      } catch (error) {
        // Some mobile browsers reject optional constraint sets. Retry minimally.
        if (error instanceof DOMException && error.name === "OverconstrainedError") {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false, video: { facingMode: facing },
          });
        } else {
          throw error;
        }
      }
      if (cycleRef.current !== cycle || !isMounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      await video.play();
      if (cycleRef.current !== cycle || !isMounted.current) return;
      const [track] = stream.getVideoTracks();
      const supportsTorch = !!(track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch;
      setView((previous) => ({
        ...previous,
        phase: "scanning",
        torchSupported: supportsTorch,
        status: "Looking for the two-rail WaveCode pattern…",
      }));
      void scanLoop(cycle);
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (cycleRef.current !== cycle || !isMounted.current) return;
      releaseCamera();
      setView((previous) => ({
        ...previous, phase: "error", torchSupported: false,
        status: cameraMessage(error),
      }));
    }
  }, [engine, releaseCamera, scanLoop, view.facing]);

  const stop = useCallback(() => {
    releaseCamera();
    setView((previous) => ({
      ...previous, phase: "idle", torchEnabled: false, torchSupported: false,
      status: "Position a WaveCode inside the frame.",
    }));
  }, [releaseCamera]);

  const switchCamera = useCallback(() => {
    const facing = view.facing === "environment" ? "user" : "environment";
    void start(facing);
  }, [start, view.facing]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !view.torchSupported) return;
    const enabled = !view.torchEnabled;
    try {
      await track.applyConstraints({ advanced: [{ torch: enabled } as TorchConstraint] });
      setView((previous) => ({ ...previous, torchEnabled: enabled }));
    } catch {
      setView((previous) => ({
        ...previous,
        status: "This camera can't control its flashlight.",
        torchSupported: false,
      }));
    }
  }, [view.torchSupported, view.torchEnabled]);

  const scanPhoto = useCallback(async (file: File) => {
    releaseCamera();
    const cycle = cycleRef.current;
    setView((previous) => ({
      ...previous,
      phase: "uploading",
      result: null,
      torchEnabled: false,
      torchSupported: false,
      status: "Analyzing your image in high detail…",
    }));
    try {
      await engine.initialize();
      if (cycleRef.current !== cycle || !isMounted.current) return;

      const original = await originalPhotoBytes(file);
      if (cycleRef.current !== cycle || !isMounted.current) return;
      if (original) {
        setView((previous) => ({
          ...previous, status: "Checking the original photo without resizing…",
        }));
        const detected = codeCandidates(await engine.scan(original));
        if (cycleRef.current !== cycle || !isMounted.current) return;
        if (detected.length) {
          finish(detected, "image");
          return;
        }
      }

      for await (const { bytes, pass, total } of captureFile(file)) {
        if (cycleRef.current !== cycle || !isMounted.current) return;
        setView((previous) => ({
          ...previous,
          status: `Analyzing your image · pass ${pass} of ${total}…`,
        }));
        const detected = codeCandidates(await engine.scan(bytes));
        if (cycleRef.current !== cycle || !isMounted.current) return;
        if (detected.length) {
          finish(detected, "image");
          return;
        }
      }
      setView((previous) => ({
        ...previous,
        phase: "idle",
        status: "No WaveCode found. Try a sharper image with the full code visible.",
      }));
    } catch (error) {
      if (cycleRef.current !== cycle || !isMounted.current) return;
      setView((previous) => ({
        ...previous,
        phase: "error",
        status: error instanceof Error ? error.message : "Could not read this image.",
      }));
    }
  }, [engine, finish, releaseCamera]);

  const dismissResult = useCallback(() => {
    setView((previous) => ({ ...previous, result: null, phase: "idle" }));
  }, []);

  useEffect(() => {
    if (!selected) releaseCamera();
    return () => {
      if (!selected) return;
      releaseCamera();
    };
  }, [selected, releaseCamera]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      releaseCamera();
    };
  }, [releaseCamera]);

  useEffect(() => {
    const pauseInBackground = () => {
      if (!document.hidden || !streamRef.current) return;
      releaseCamera();
      if (isMounted.current) {
        setView((previous) => ({
          ...previous,
          phase: "idle",
          status: "Camera paused while the app was in the background. Tap Open camera to resume.",
          torchEnabled: false,
          torchSupported: false,
        }));
      }
    };
    document.addEventListener("visibilitychange", pauseInBackground);
    return () => document.removeEventListener("visibilitychange", pauseInBackground);
  }, [releaseCamera]);

  return {
    videoRef, view,
    start, stop, switchCamera, toggleTorch, scanPhoto, dismissResult,
  };
}
