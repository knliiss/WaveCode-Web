const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_NATIVE_BYTES = 16 * 1024 * 1024;

export interface PhotoFileInfo {
  type: string;
  size: number;
}

export function validatePhotoFile(file: PhotoFileInfo): void {
  if (file.size === 0) throw new Error("The selected image is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("The image is too large (30 MB max).");
  // Some iOS/Android file providers leave the MIME type empty.
  if (file.type && file.type !== "application/octet-stream" && !file.type.startsWith("image/")) {
    throw new Error("Choose a PNG or JPEG image.");
  }
}

export function isNativePhotoHeader(bytes: Uint8Array): boolean {
  const png = bytes.length >= 8 &&
    bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 &&
    bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  const jpeg = bytes.length >= 3 &&
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return png || jpeg;
}

export async function originalPhotoBytes(file: File): Promise<Uint8Array | null> {
  validatePhotoFile(file);
  if (file.size > MAX_NATIVE_BYTES) return null;

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!isNativePhotoHeader(header)) return null;

  // Feed the original bytes to the optical decoder before any browser
  // resampling, anti-aliasing, recompression or EXIF transformations.
  // This preserves tiny code bars whenever the original is already usable.
  return new Uint8Array(await file.arrayBuffer());
}
