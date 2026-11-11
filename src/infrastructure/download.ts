export function downloadBytes(bytes: Uint8Array, name: string, type: string): void {
  downloadBlob(new Blob([new Uint8Array(bytes)], { type }), name);
}

export function downloadSvg(svg: string, name: string): void {
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), name);
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}
