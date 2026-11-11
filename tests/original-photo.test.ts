import { describe, expect, it } from "vitest";
import { isNativePhotoHeader, originalPhotoBytes, rasterDimensions, validatePhotoFile } from "../src/infrastructure/camera/original-photo";


function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("original image fidelity", () => {
  it("checks PNG and JPEG dimensions from headers without raster decoding", () => {
    expect(rasterDimensions(pngHeader(960, 240))).toEqual({ width: 960, height: 240 });
    expect(rasterDimensions(new Uint8Array([
      255, 216, 255, 192, 0, 17, 8, 0, 240, 3, 192,
      3, 1, 17, 0, 2, 17, 0, 3, 17, 0, 0, 0,
    ]))).toEqual({ width: 960, height: 240 });
    expect(rasterDimensions(new Uint8Array([255, 216, 255, 217]))).toBeNull();
  });

  it("preserves small originals but skips full-size decoding of huge images", async () => {
    const small = pngHeader(960, 240);
    const huge = pngHeader(10000, 8000);
    const smallFile = new File([small.buffer as ArrayBuffer], "code.png", { type: "" });
    const hugeFile = new File([huge.buffer as ArrayBuffer], "image.png", { type: "image/png" });
    expect(Array.from(await originalPhotoBytes(smallFile) ?? [])).toEqual(Array.from(small));
    expect(await originalPhotoBytes(hugeFile)).toBeNull();
  });


  it("recognizes actual PNG/JPEG bytes without relying on file extension or MIME", () => {
    expect(isNativePhotoHeader(new Uint8Array([137,80,78,71,13,10,26,10]))).toBe(true);
    expect(isNativePhotoHeader(new Uint8Array([255,216,255,224]))).toBe(true);
    expect(isNativePhotoHeader(new Uint8Array([0,0,0,0]))).toBe(false);
    expect(isNativePhotoHeader(new Uint8Array([137,80,78]))).toBe(false);
  });
  it("accepts mobile photos even if the file picker omits MIME", () => {
    expect(() => validatePhotoFile({ type: "", size: 2048 })).not.toThrow();
    expect(() => validatePhotoFile({ type: "application/octet-stream", size: 2048 })).not.toThrow();
  });
  it("rejects empty, huge, and explicitly non-image files", () => {
    expect(() => validatePhotoFile({ type: "image/png", size: 0 })).toThrow("empty");
    expect(() => validatePhotoFile({ type: "text/plain", size: 1 })).toThrow("PNG or JPEG");
    expect(() => validatePhotoFile({ type: "image/jpeg", size: 30 * 1024 * 1024 + 1 })).toThrow("30 MB");
  });
});
