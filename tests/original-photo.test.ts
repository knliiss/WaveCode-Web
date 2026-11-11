import { describe, expect, it } from "vitest";
import { isNativePhotoHeader, validatePhotoFile } from "../src/infrastructure/camera/original-photo";

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
