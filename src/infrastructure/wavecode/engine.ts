import type {
  EngineRequest,
  EngineResponse,
  GeneratedWaveCode,
  LocatedWaveCode,
  WaveCodeEngine,
  V2Geometry,
  ScanMode,
} from "../../domain/wavecode";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
type EngineCommand = WithoutId<EngineRequest>;

type Pending = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

export class BrowserWaveCodeEngine implements WaveCodeEngine {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 0;
  private destroyed = false;

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.ok) pending.resolve(response.value);
      else pending.reject(new Error(response.error));
    };
    this.worker.onerror = () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("The WaveCode decoding engine could not start."));
      }
      this.pending.clear();
    };
  }

  private request<T>(
    request: EngineCommand,
    transfer?: Transferable[],
  ): Promise<T> {
    if (this.destroyed) return Promise.reject(new Error("WaveCode engine is closed."));
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker.postMessage({ ...request, id }, transfer ?? []);
    });
  }

  initialize(): Promise<void> {
    return this.request<void>({ action: "initialize" });
  }

  scan(image: Uint8Array, mode: ScanMode = "all", candidate = 0): Promise<LocatedWaveCode[]> {
    const input = new Uint8Array(image);
    return this.request<LocatedWaveCode[]>({ action: "scan", image: input, mode, candidate }, [input.buffer]);
  }

  generate(
    url: string,
    moment?: number,
    version: 1 | 2 = 1,
    geometry?: V2Geometry,
  ): Promise<GeneratedWaveCode> {
    return this.request<GeneratedWaveCode>({
      action: "generate",
      url,
      moment,
      version,
      geometry,
      width: 960,
      height: 240,
    });
  }

  generateDual(
    firstUrl: string,
    secondUrl: string,
    firstMoment?: number,
    secondMoment?: number,
    geometry: V2Geometry = {
      payloadHeight: 172,
      logoHeight: 125,
      payloadCenterGap: 11,
      logoPayloadGap: 20,
    },
  ): Promise<GeneratedWaveCode> {
    return this.request<GeneratedWaveCode>({
      action: "generate-dual",
      firstUrl,
      secondUrl,
      firstMoment,
      secondMoment,
      geometry,
    });
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worker.terminate();
    for (const pending of this.pending.values()) {
      pending.reject(new Error("WaveCode engine was closed."));
    }
    this.pending.clear();
  }
}
