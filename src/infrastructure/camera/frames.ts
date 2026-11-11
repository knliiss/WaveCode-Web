export type CaptureMode = "finder" | "detail" | "full";

export interface CropArea {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  width: number;
  height: number;
}

export function captureArea(videoWidth: number, videoHeight: number, mode: CaptureMode): CropArea {
  if (!(videoWidth > 0) || !(videoHeight > 0)) {
    throw new Error("Camera is not ready.");
  }
  const fraction: readonly [number, number] = mode === "finder" ? [0.96, 0.62] : mode === "detail" ? [0.78, 0.4] : [1, 1];
  const sw = Math.round(videoWidth * fraction[0]);
  const sh = Math.round(videoHeight * fraction[1]);
  const longest = mode === "detail" ? 1560 : mode === "full" ? 1600 : 1440;
  const factor = Math.min(1, longest / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * factor));
  const height = Math.max(1, Math.round(sh * factor));

  return {
    sx: Math.round((videoWidth - sw) / 2),
    sy: Math.round((videoHeight - sh) / 2),
    sw,
    sh,
    width,
    height,
  };
}

async function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Unable to capture an image from the camera."));
    }, "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function captureFrame(video: HTMLVideoElement, mode: CaptureMode): Promise<Uint8Array> {
  const area = captureArea(video.videoWidth, video.videoHeight, mode);
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
  if (!context) throw new Error("2D canvas rendering is unavailable.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    video, area.sx, area.sy, area.sw, area.sh, 0, 0, area.width, area.height,
  );
  return toPng(canvas);
}

export async function captureFile(file: File): Promise<Uint8Array[]> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a PNG or JPEG image.");
  if (file.size > 30 * 1024 * 1024) throw new Error("The image is too large (30 MB max).");

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 80_000_000) {
      throw new Error("The image is too large to process on this device.");
    }

    const shots: Uint8Array[] = [];
    for (const limit of [1800, 2600]) {
      if (limit === 2600 && Math.max(bitmap.width, bitmap.height) <= 1800) break;
      const scale = Math.min(1, limit / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("2D canvas rendering is unavailable.");
      context.drawImage(bitmap, 0, 0, width, height);
      shots.push(await toPng(canvas));
    }
    return shots;
  } finally {
    bitmap.close();
  }
}
