import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPngImage } from "../src/infrastructure/clipboard";

afterEach(() => vi.unstubAllGlobals());

describe("copying the generated code", () => {
  it("writes the original PNG image to the clipboard, not the track URL", async () => {
    const source = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 42]);
    let written: { type: string; blob: Blob } | undefined;

    class ClipboardItemMock {
      constructor(items: Record<string, Blob>) {
        written = { type: Object.keys(items)[0], blob: items["image/png"] };
      }
    }

    const write = vi.fn(async (_items: unknown[]) => {});
    vi.stubGlobal("ClipboardItem", ClipboardItemMock);
    vi.stubGlobal("navigator", { clipboard: { write } });

    await copyPngImage(source);

    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0]).toHaveLength(1);
    expect(written?.type).toBe("image/png");
    expect(Array.from(new Uint8Array(await written!.blob.arrayBuffer()))).toEqual(Array.from(source));
  });

  it("reports an unsupported clipboard and guides the user to Save PNG", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { write: vi.fn() } });

    await expect(copyPngImage(new Uint8Array(2))).rejects.toThrow(/Save the PNG/);
  });

  it("reports permission errors without losing the generated code", async () => {
    vi.stubGlobal("ClipboardItem", class {
      constructor(_items: Record<string, Blob>) {}
    });
    vi.stubGlobal("navigator", {
      clipboard: { write: vi.fn(async () => { throw new Error("NotAllowedError"); }) },
    });

    await expect(copyPngImage(new Uint8Array(2))).rejects.toThrow(/clipboard permission/);
  });
});
