export type CaptureMode = "finder" | "detail" | "full";

export interface CropArea {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  width: number;
  height: number;
}

export function captureArea(videoWidth: number, videoHeight: number, mode: CaptureMode, viewWidth = videoWidth, viewHeight = videoHeight): CropArea {
  if (!(videoWidth > 0) || !(videoHeight > 0)) {
    throw new Error("Camera is not ready.");
  }
  const viewAspect = viewWidth > 0 && viewHeight > 0 ? viewWidth / viewHeight : videoWidth / videoHeight;
  const sensorAspect = videoWidth / videoHeight;
  const visibleWidth = mode === "full" ? videoWidth : sensorAspect > viewAspect ? videoHeight * viewAspect : videoWidth;
  const visibleHeight = mode === "full" ? videoHeight : sensorAspect < viewAspect ? videoWidth / viewAspect : videoHeight;
  const fraction: readonly [number, number] = mode === "finder" ? [0.96, 0.62] : mode === "detail" ? [0.78, 0.4] : [1, 1];
  const sw = Math.round(visibleWidth * fraction[0]);
  const sh = Math.round(visibleHeight * fraction[1]);
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
  const rect = video.getBoundingClientRect();
  const area = captureArea(video.videoWidth, video.videoHeight, mode, rect.width, rect.height);
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

export interface PhotoCapture {
  bytes: Uint8Array;
  pass: number;
  total: number;
}

export function photoScanAreas(sourceWidth: number, sourceHeight: number): CropArea[] {
  if (!(sourceWidth > 0 && sourceHeight > 0)) {
    throw new Error("Invalid image dimensions.");
  }
  const maxDimension = Math.max(sourceWidth, sourceHeight);
  const fromRegion = (sx: number, sy: number, sw: number, sh: number, limit: number): CropArea => {
    const scale = Math.min(1, limit / Math.max(sw, sh));
    return {
      sx: Math.round(sx), sy: Math.round(sy),
      sw: Math.round(sw), sh: Math.round(sh),
      width: Math.max(1, Math.round(sw * scale)),
      height: Math.max(1, Math.round(sh * scale)),
    };
  };

  const areas = [fromRegion(0, 0, sourceWidth, sourceHeight, 1800)];
  if (maxDimension > 1800) {
    // A high-detail full-frame attempt improves thin bars and JPEG photographs.
    areas.push(fromRegion(0, 0, sourceWidth, sourceHeight, 2600));
  }
  if (maxDimension > 2600) {
    // Small marks in a large camera photo can disappear when downscaled.
    // Overlapping tiles preserve detail while retaining the official Rust
    // decoder's 20-megapixel input limit, without server-side processing.
    const sw = Math.round(sourceWidth * 0.65);
    const sh = Math.round(sourceHeight * 0.65);
    for (const [fx, fy] of [
      [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5],
    ] as const) {
      areas.push(fromRegion(
        (sourceWidth - sw) * fx,
        (sourceHeight - sh) * fy,
        sw, sh, 1850,
      ));
    }
  }
  return areas;
}

async function openPhoto(file: File): Promise<{
  image: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  release(): void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        image: bitmap,
        width: bitmap.width, height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // A few iOS/Safari versions cannot decode all photo formats as
      // ImageBitmap, even when their native <img> element supports them.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This photo format cannot be decoded by your browser."));
      image.src = objectUrl;
    });
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function photoBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const encode = (type: string, quality?: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to process this photo.")),
      type, quality);
  });

  // The Rust scanner accepts PNG/JPEG but enforces a 16 MiB input limit.
  // High-resolution noisy photos can exceed it as lossless PNG. Use a
  // high-quality JPEG fallback rather than silently missing an actual code.
  let blob = await encode("image/png");
  if (blob.size > 15 * 1024 * 1024) blob = await encode("image/jpeg", 0.96);
  if (blob.size > 16 * 1024 * 1024) {
    throw new Error("This image is too detailed to scan on this device.");
  }
  return new Uint8Array(await blob.arrayBuffer());
}

export async function* captureFile(file: File): AsyncGenerator<PhotoCapture> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a supported image file.");
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("The image is too large (30 MB max).");
  }
  const photo = await openPhoto(file);
  try {
    if (photo.width * photo.height > 80_000_000) {
      throw new Error("The image is too large to process on this device.");
    }
    const areas = photoScanAreas(photo.width, photo.height);
    for (const [index, area] of areas.entries()) {
      const canvas = document.createElement("canvas");
      canvas.width = area.width;
      canvas.height = area.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("2D canvas rendering is unavailable.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        photo.image,
        area.sx, area.sy, area.sw, area.sh,
        0, 0, area.width, area.height,
      );
      yield {
        bytes: await photoBytes(canvas),
        pass: index + 1,
        total: areas.length,
      };
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    photo.release();
  }
}
