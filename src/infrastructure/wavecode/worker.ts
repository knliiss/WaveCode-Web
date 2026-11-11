/// <reference lib="webworker" />
import type { EngineRequest, EngineResponse, LocatedWaveCode } from "../../domain/wavecode";

type WasmModule = typeof import("../../generated/wavecode/wavecode_wasm.js");

const context = self as unknown as DedicatedWorkerGlobalScope;
let wasmPromise: Promise<WasmModule> | undefined;

function wasmEngine(): Promise<WasmModule> {
  wasmPromise ??= (async () => {
    const wasm = await import("../../generated/wavecode/wavecode_wasm.js");
    const file = await import("../../generated/wavecode/wavecode_wasm_bg.wasm?url");
    await wasm.default({ module_or_path: file.default });
    if (wasm.abi_version() !== 1 || wasm.format_version() !== 1) {
      throw new Error("WaveCode SDK version mismatch. Rebuild the pinned Rust SDK.");
    }
    return wasm;
  })();
  return wasmPromise;
}

function scan(wasm: WasmModule, image: Uint8Array): LocatedWaveCode[] {
  try {
    const items = JSON.parse(wasm.scan_all(image)) as LocatedWaveCode[];
    return items.filter((item) =>
      typeof item.url === "string" &&
      item.bounds !== null &&
      Number.isFinite(item.bounds?.width) &&
      item.bounds.width > 0,
    );
  } catch {
    // "No code in frame" is expected during live scanning. Image inputs
    // are pre-validated in the UI before this operation is invoked.
    return [];
  }
}

context.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  try {
    const wasm = await wasmEngine();
    let value: unknown;
    if (request.action === "initialize") {
      value = true;
    } else if (request.action === "scan") {
      value = scan(wasm, request.image);
    } else {
      const symbols = wasm.encode_url(request.url, request.moment);
      const svg = wasm.render_svg(symbols, request.width, request.height);
      const png = wasm.render_png(symbols, request.width, request.height);
      value = { canonicalUrl: wasm.decode_symbols(symbols), svg, png };
    }
    const answer: EngineResponse = { id: request.id, ok: true, value };
    if (request.action === "generate") {
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
