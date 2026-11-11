import { describe, expect, it } from "vitest";
import { isNativePhotoHeader, originalPhotoBytes, rasterDimensions, validatePhotoFile } from "../src/infrastructure/camera/original-photo";

describe("original image fidelity", () => {
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


function pngHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

describe("bounded raw-photo decoding", () => {
  it("reads PNG dimensions before decoding pixel data", () => {
    expect(rasterDimensions(pngHeader(960, 240))).toEqual({ width: 960, height: 240 });
    expect(rasterDimensions(pngHeader(0, 1))).toBeNull();
    expect(rasterDimensions(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBeNull();
  });

  it("walks JPEG markers to find the Start Of Frame dimensions", () => {
    const frame = new Uint8Array([
      255, 216,
      255, 224, 0, 4, 0, 0,
      255, 192, 0, 17, 8, 0, 240, 3, 192,
      3, 1, 17, 0, 2, 17, 0, 3, 17, 0,
      255, 217,
    ]);
    expect(rasterDimensions(frame)).toEqual({ width: 960, height: 240 });
    expect(rasterDimensions(new Uint8Array([255, 216, 255, 217]))).toBeNull();
  });

  it("skips unsafe direct decode for giant compressed images", async () => {
    const bytes = pngHeader(10000, 8000);
    const file = new File([bytes], "giant.png", { type: "image/png" });
    expect(await originalPhotoBytes(file)).toBeNull();
  });

  it("keeps the original bytes for small supported images", async () => {
    const bytes = pngHeader(960, 240);
    const file = new File([bytes], "photo", { type: "" });
    expect(Array.from(await originalPhotoBytes(file) ?? [])).toEqual(Array.from(bytes));
  });
});
