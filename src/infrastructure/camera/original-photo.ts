const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_NATIVE_BYTES = 16 * 1024 * 1024;
const MAX_DIRECT_PIXELS = 6_000_000;

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

export interface RasterDimensions {
  width: number;
  height: number;
}

export function rasterDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (!isNativePhotoHeader(bytes)) return null;
  if (bytes[0] === 137) {
    if (bytes.length < 24 || bytes[12] !== 73 || bytes[13] !== 72 ||
      bytes[14] !== 68 || bytes[15] !== 82) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return width && height ? { width, height } : null;
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    if (offset >= bytes.length) return null;

    const marker = bytes[offset++]!;
    if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (marker === 217 || marker === 218) return null;

    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return null;
    const isFrame = marker >= 192 && marker <= 207 && ![196, 200, 204].includes(marker);
    if (isFrame) {
      if (length < 7) return null;
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      return width && height ? { width, height } : null;
    }
    offset += length;
  }
  return null;
}

export async function originalPhotoBytes(file: File): Promise<Uint8Array | null> {
  validatePhotoFile(file);
  if (file.size > MAX_NATIVE_BYTES) return null;

  // Decode the header before the full image. A highly compressed 80 MP
  // JPEG may be only a few megabytes but can exhaust mobile WASM memory.
  const header = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  const dimensions = rasterDimensions(header);
  if (!dimensions || dimensions.width * dimensions.height > MAX_DIRECT_PIXELS) return null;

  // Feed the original bytes to the optical decoder before any browser
  // resampling, anti-aliasing, recompression or EXIF transformations.
  // This preserves tiny code bars whenever the original is already usable.
  return new Uint8Array(await file.arrayBuffer());
}
