export type CaptureMode = "finder" | "detail" | "full" | "upper" | "lower" | "left" | "right";

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
  const fraction: readonly [number, number] = mode === "finder" ? [0.96, 0.62]
    : mode === "detail" ? [0.78, 0.4]
      : mode === "upper" || mode === "lower" ? [0.96, 0.7]
        : mode === "left" || mode === "right" ? [0.7, 0.88]
          : [1, 1];
  const sw = Math.round(visibleWidth * fraction[0]);
  const sh = Math.round(visibleHeight * fraction[1]);
  const longest = mode === "detail" ? 1560 : mode === "full" ? 1600 : 1440;
  const factor = Math.min(1, longest / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * factor));
  const height = Math.max(1, Math.round(sh * factor));

  return {
    sx: Math.round((videoWidth - visibleWidth) / 2 +
      (visibleWidth - sw) * (mode === "left" ? 0 : mode === "right" ? 1 : 0.5)),
    sy: Math.round((videoHeight - visibleHeight) / 2 +
      (visibleHeight - sh) * (mode === "upper" ? 0 : mode === "lower" ? 1 : 0.5)),
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
  const areas: CropArea[] = [];

  const append = (
    widthFraction: number,
    heightFraction: number,
    fx: number,
    fy: number,
    limit: number,
  ) => {
    const sw = Math.max(1, Math.round(sourceWidth * widthFraction));
    const sh = Math.max(1, Math.round(sourceHeight * heightFraction));
    const scale = Math.min(1, limit / Math.max(sw, sh));
    areas.push({
      sx: Math.round((sourceWidth - sw) * fx),
      sy: Math.round((sourceHeight - sh) * fy),
      sw,
      sh,
      width: Math.max(1, Math.round(sw * scale)),
      height: Math.max(1, Math.round(sh * scale)),
    });
  };

  append(1, 1, 0, 0, 1800);
  if (maxDimension > 1800) {
    append(1, 1, 0, 0, 2600);
  }

  if (sourceWidth < 300 || sourceHeight < 300) return areas;

  // Scan overlapping regions even for ordinary phone photos. The previous
  // implementation only tiled photos wider than 2600 px, so a physical mark
  // beside a logo or on a busy background was never isolated.
  for (const [fx, fy] of [
    [0.5, 0.5],
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ] as const) {
    append(0.7, 0.7, fx, fy, 1800);
  }

  if (maxDimension > 900) {
    for (const [fx, fy] of [
      [0.5, 0.5],
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ] as const) {
      append(0.55, 0.55, fx, fy, 1800);
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
  // Some mobile file pickers omit the MIME type even for valid PNG/JPEG.
  // Trust the browser image decoder for empty types, not an extension guess.
  if (file.type && !file.type.startsWith("image/") && file.type !== "application/octet-stream") {
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
