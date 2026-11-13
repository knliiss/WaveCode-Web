export interface WaveCodeCapsule {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface WaveCodePreviewGeometry {
  width: number;
  height: number;
  viewBox: string;
  capsules: WaveCodeCapsule[];
}

const svgNamespace = "http://www.w3.org/2000/svg";
const capsuleClasses = new Set([
  "wavecode-upper",
  "wavecode-lower",
  "wavecode-guard-upper",
  "wavecode-guard-lower",
  "w-capsule",
  "data-upper",
  "data-lower",
]);

function numericAttribute(element: Element, name: string): number | null {
  const value = element.getAttribute(name);
  if (value === null || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function previewGeometryFromSvg(source: string): WaveCodePreviewGeometry | null {
  if (source.length === 0 || source.length > 32_768) return null;

  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (root.localName !== "svg" || root.namespaceURI !== svgNamespace) return null;

  const viewBox = root.getAttribute("viewBox");
  if (!viewBox) return null;

  const bounds = viewBox.trim().split(/[\s,]+/).map(Number);
  if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) return null;
  const [left, top, width, height] = bounds;
  if (left !== 0 || top !== 0 || !width || !height ||
    width <= 0 || height <= 0 || width > 4_096 || height > 4_096) return null;

  const capsules: WaveCodeCapsule[] = [];
  let backgroundCount = 0;
  let guardCount = 0;
  let wCount = 0;
  let payloadUpperCount = 0;
  let payloadLowerCount = 0;

  for (const element of Array.from(root.children)) {
    if (element.localName !== "rect" || element.namespaceURI !== svgNamespace) return null;

    if (element.getAttribute("width") === "100%" &&
      element.getAttribute("height") === "100%" &&
      element.getAttribute("fill") === "white" &&
      element.getAttribute("class") === null) {
      backgroundCount += 1;
      continue;
    }

    const capsuleClass = element.getAttribute("class");
    if (!capsuleClass || !capsuleClasses.has(capsuleClass)) return null;

    const x = numericAttribute(element, "x");
    const y = numericAttribute(element, "y");
    const barWidth = numericAttribute(element, "width");
    const barHeight = numericAttribute(element, "height");
    const radius = numericAttribute(element, "rx");

    if (x === null || y === null || barWidth === null || barHeight === null || radius === null ||
      barWidth <= 0 || barHeight <= 0 || radius < 0 || radius > barWidth / 2 + 0.01 ||
      x + barWidth > width + 0.01 || y + barHeight > height + 0.01) return null;

    capsules.push({ x, y, width: barWidth, height: barHeight, radius });
    if (capsuleClass.startsWith("wavecode-guard-")) guardCount += 1;
    if (capsuleClass === "w-capsule") wCount += 1;
    if (capsuleClass === "data-upper") payloadUpperCount += 1;
    if (capsuleClass === "data-lower") payloadLowerCount += 1;
  }

  const legacyV1 = capsules.length === 72 && guardCount === 4 && wCount === 0;
  const capsuleV2 = wCount === 22 && guardCount === 0 &&
    payloadUpperCount === payloadLowerCount && payloadUpperCount >= 9 &&
    payloadUpperCount <= 57 && capsules.length === 22 + payloadUpperCount * 2;
  if (backgroundCount > 1 || (!legacyV1 && !capsuleV2)) return null;
  return { width, height, viewBox, capsules };
}
