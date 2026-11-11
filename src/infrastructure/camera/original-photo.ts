const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_NATIVE_BYTES = 16 * 1024 * 1024;
const MAX_DIRECT_SCAN_PIXELS = 6_000_000;
const MAX_HEADER_BYTES = 64 * 1024;

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

/** Read untrusted image dimensions without allocating or decoding the raster. */
export function rasterDimensions(bytes: Uint8Array): RasterDimensions | null {
  if (!isNativePhotoHeader(bytes)) return null;
  const dimensions = (width: number, height: number): RasterDimensions | null =>
    Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
      ? { width, height } : null;

  if (bytes[0] === 137) {
    // PNG: the first chunk must be IHDR, containing big-endian dimensions.
    if (bytes.length < 24 || bytes[12] !== 73 || bytes[13] !== 72 ||
      bytes[14] !== 68 || bytes[15] !== 82) return null;
    const bigEndian = (offset: number) =>
      bytes[offset]! * 16777216 + bytes[offset + 1]! * 65536 +
      bytes[offset + 2]! * 256 + bytes[offset + 3]!;
    return dimensions(bigEndian(16), bigEndian(20));
  }

  // JPEG: walk bounded marker segments until the first Start Of Frame.
  // EXIF and ICC metadata may appear before image dimensions.
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    if (offset + 2 >= bytes.length) return null;
    const marker = bytes[offset++]!;
    if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (marker === 217 || marker === 218) return null;

    const length = bytes[offset]! * 256 + bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return null;
    const startOfFrame =
      marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204;
    if (startOfFrame) {
      if (length < 7) return null;
      const height = bytes[offset + 3]! * 256 + bytes[offset + 4]!;
      const width = bytes[offset + 5]! * 256 + bytes[offset + 6]!;
      return dimensions(width, height);
    }
    offset += length;
  }
  return null;
}

export async function originalPhotoBytes(file: File): Promise<Uint8Array | null> {
  validatePhotoFile(file);
  if (file.size > MAX_NATIVE_BYTES) return null;

  const header = new Uint8Array(await file.slice(0, MAX_HEADER_BYTES).arrayBuffer());
  const dimensions = rasterDimensions(header);
  if (!dimensions || dimensions.width * dimensions.height > MAX_DIRECT_SCAN_PIXELS) {
    // The decoder would load the full raster into WASM memory. For large
    // photos, the adaptive 1800/2600px and overlapping tile paths are safer.
    return null;
  }

  // Feed the original bytes to the optical decoder before any browser
  // resampling, anti-aliasing, recompression or EXIF transformations.
  // This preserves tiny code bars whenever the original is already usable.
  return new Uint8Array(await file.arrayBuffer());
}
