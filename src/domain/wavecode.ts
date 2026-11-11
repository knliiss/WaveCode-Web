export type Orientation = "upright" | "upside_down";

export interface ScanBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LocatedWaveCode {
  url: string;
  orientation: Orientation;
  corrected_symbols: number;
  bounds: ScanBounds;
}

export interface GeneratedWaveCode {
  svg: string;
  png: Uint8Array;
  canonicalUrl: string;
}

export type ScanSource = "camera" | "image";

export type EngineRequest =
  | { id: number; action: "initialize" }
  | { id: number; action: "scan"; image: Uint8Array }
  | { id: number; action: "generate"; url: string; moment?: number; width: number; height: number };

export type EngineResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string };

export interface WaveCodeEngine {
  initialize(): Promise<void>;
  scan(image: Uint8Array): Promise<LocatedWaveCode[]>;
  generate(url: string, moment?: number): Promise<GeneratedWaveCode>;
}
