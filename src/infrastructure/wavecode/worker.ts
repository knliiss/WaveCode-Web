/// <reference lib="webworker" />
import type {
  EngineRequest,
  EngineResponse,
  GeneratedWaveCode,
  LocatedWaveCode,
  V2Geometry,
  ScanMode,
} from "../../domain/wavecode";

type WasmModule = typeof import("../../generated/wavecode/wavecode_wasm.js");
type V2Frame = { metadata: number; symbols: number[] };
type V2Decoded = {
  urls: string[];
  bounds: { left: number; top: number; width: number; height: number };
  corrected_symbols: number;
};

const context = self as unknown as DedicatedWorkerGlobalScope;
let wasmPromise: Promise<WasmModule> | undefined;

const defaultGeometry: V2Geometry = {
  payloadHeight: 172,
  logoHeight: 125,
  payloadCenterGap: 11,
  logoPayloadGap: 20,
};

function wasmEngine(): Promise<WasmModule> {
  wasmPromise ??= (async () => {
    const wasm = await import("../../generated/wavecode/wavecode_wasm.js");
    const file = await import("../../generated/wavecode/wavecode_wasm_bg.wasm?url");
    await wasm.default({ module_or_path: file.default });
    if (wasm.abi_version() !== 1 || wasm.format_version() !== 1 ||
      typeof wasm.v2_scan_image !== "function" ||
      typeof wasm.v2_scan_image_oblique !== "function" ||
      typeof wasm.v2_encode_links !== "function") {
      throw new Error("WaveCode V2 SDK mismatch. Rebuild the pinned Rust SDK.");
    }
    return wasm;
  })();
  return wasmPromise;
}

function v2Located(value: V2Decoded): LocatedWaveCode | null {
  if (!Array.isArray(value.urls) || !value.urls.length ||
    value.urls.some((url) => typeof url !== "string") ||
    !value.bounds || !Number.isFinite(value.bounds.width) ||
    !Number.isFinite(value.bounds.height) || value.bounds.width <= 0 ||
    value.bounds.height <= 0) return null;
  return {
    url: value.urls[0]!,
    urls: value.urls,
    format: "v2",
    orientation: "upright",
    corrected_symbols: value.corrected_symbols,
    bounds: value.bounds,
  };
}

function scan(
  wasm: WasmModule,
  image: Uint8Array,
  mode: ScanMode = "all",
  candidate = 0,
): LocatedWaveCode[] {
  const found: LocatedWaveCode[] = [];
  try {
    const result = mode === "v2-oblique"
      ? wasm.v2_scan_image_oblique(image, candidate)
      : wasm.v2_scan_image(image);
    const located = v2Located(JSON.parse(result) as V2Decoded);
    if (located) found.push(located);
  } catch {
    // V2 finder is opt-in: V1 frames are not V2 optical marks.
  }
  if (mode === "all") try {
    const legacy = JSON.parse(wasm.scan_all(image)) as LocatedWaveCode[];
    found.push(...legacy.filter((item) =>
      typeof item.url === "string" &&
      item.bounds !== null &&
      Number.isFinite(item.bounds?.width) &&
      item.bounds.width > 0,
    ).map((item) => ({ ...item, format: "v1" as const })));
  } catch {
    // Missing a V1 frame is normal when only V2 is visible.
  }
  return found;
}

function renderV2(
  wasm: WasmModule,
  raw: string,
  geometry: V2Geometry,
): GeneratedWaveCode {
  const frame = JSON.parse(raw) as V2Frame;
  if (!Array.isArray(frame.symbols) || !Number.isInteger(frame.metadata)) {
    throw new Error("Invalid WaveCode V2 encoder response.");
  }
  const symbols = new Uint8Array(frame.symbols);
  const args = [
    frame.metadata, symbols, 16, geometry.payloadHeight, 12,
    geometry.payloadCenterGap, geometry.logoPayloadGap, geometry.logoHeight,
  ] as const;
  const svg = wasm.v2_render_svg_with_geometry(...args);
  const png = wasm.v2_render_png_with_geometry(...args);
  const decoded = JSON.parse(wasm.v2_decode_frame(frame.metadata, symbols)) as { urls: string[] };
  if (!Array.isArray(decoded.urls) || !decoded.urls.length) {
    throw new Error("WaveCode V2 decoder returned no links.");
  }
  return {
    canonicalUrl: decoded.urls[0]!,
    urls: decoded.urls,
    format: "v2",
    svg,
    png,
  };
}

context.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  try {
    const wasm = await wasmEngine();
    let value: unknown;
    if (request.action === "initialize") {
      value = true;
    } else if (request.action === "scan") {
      value = scan(wasm, request.image, request.mode, request.candidate);
    } else if (request.action === "generate-dual") {
      value = renderV2(
        wasm,
        wasm.v2_encode_links(
          request.firstUrl, request.secondUrl, request.firstMoment, request.secondMoment,
        ),
        request.geometry ?? defaultGeometry,
      );
    } else if (request.version === 2) {
      value = renderV2(
        wasm,
        wasm.v2_encode_url(request.url, request.moment),
        request.geometry ?? defaultGeometry,
      );
    } else {
      const symbols = wasm.encode_url(request.url, request.moment);
      const svg = wasm.render_svg(symbols, request.width, request.height);
      const png = wasm.render_png(symbols, request.width, request.height);
      value = { canonicalUrl: wasm.decode_symbols(symbols), svg, png, format: "v1" };
    }
    const answer: EngineResponse = { id: request.id, ok: true, value };
    if (request.action === "generate" || request.action === "generate-dual") {
      const png = (value as { png: Uint8Array }).png;
      context.postMessage(answer, [png.buffer]);
    } else {
      context.postMessage(answer);
    }
  } catch (error) {
    const answer: EngineResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    context.postMessage(answer);
  }
};
