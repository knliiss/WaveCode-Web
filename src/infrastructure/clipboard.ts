export function copyPngImage(png: Uint8Array): Promise<void> {
  if (typeof ClipboardItem === "undefined" || typeof navigator.clipboard?.write !== "function") {
    return Promise.reject(new Error("This browser can't copy images. Save the PNG instead."));
  }

  const image = new Blob([new Uint8Array(png)], { type: "image/png" });
  const item = new ClipboardItem({ "image/png": image });

  return navigator.clipboard.write([item]).catch(() => {
    throw new Error("Couldn't copy the image. Check clipboard permission or save the PNG.");
  });
}
