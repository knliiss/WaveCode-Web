export type Orientation = "upright" | "upside_down";

export interface ScanBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LocatedWaveCode {
  url: string;
  urls?: string[];
  format?: "v1" | "v2";
  orientation: Orientation;
  corrected_symbols: number;
  bounds: ScanBounds;
}

export interface GeneratedWaveCode {
  svg: string;
  png: Uint8Array;
  canonicalUrl: string;
  urls?: string[];
  format?: "v1" | "v2";
}

export type ScanSource = "camera" | "image";
export type ScanMode = "all" | "v2";

export interface V2Geometry {
  payloadHeight: number;
  logoHeight: number;
  payloadCenterGap: number;
  logoPayloadGap: number;
}

export type EngineRequest =
  | { id: number; action: "initialize" }
  | { id: number; action: "scan"; image: Uint8Array; mode?: ScanMode }
  | {
      id: number;
      action: "generate";
      url: string;
      moment?: number;
      width: number;
      height: number;
      version?: 1 | 2;
      geometry?: V2Geometry;
    }
  | {
      id: number;
      action: "generate-dual";
      firstUrl: string;
      secondUrl: string;
      firstMoment?: number;
      secondMoment?: number;
      geometry: V2Geometry;
    };

export type EngineResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string };

export interface WaveCodeEngine {
  initialize(): Promise<void>;
  scan(image: Uint8Array, mode?: ScanMode): Promise<LocatedWaveCode[]>;
  generate(url: string, moment?: number, version?: 1 | 2, geometry?: V2Geometry): Promise<GeneratedWaveCode>;
  generateDual(
    firstUrl: string,
    secondUrl: string,
    firstMoment?: number,
    secondMoment?: number,
    geometry?: V2Geometry,
  ): Promise<GeneratedWaveCode>;
}
