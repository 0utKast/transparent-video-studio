export type MattingMode = 
  | 'chroma-green' 
  | 'chroma-blue' 
  | 'chroma-custom' 
  | 'difference' 
  | 'luma' 
  | 'procedural';

export type BackgroundMode = 
  | 'transparent' 
  | 'green' 
  | 'office' 
  | 'cyberpunk' 
  | 'bokeh' 
  | 'custom';

export type SourceType = 
  | 'demo' 
  | 'webcam' 
  | 'file' 
  | 'screen';

export interface MattingParams {
  threshold: number;         // 0.0 - 1.0 (cut sensitivity)
  feather: number;           // 0.0 - 1.0 (edge softness / blur)
  despill: number;           // 0.0 - 1.0 (color fringe suppression)
  choke: number;             // -1.0 to 1.0 (erode or dilate mask)
  keyColor: [number, number, number]; // [r, g, b] 0-255
  simulateSmurfBug: boolean; // Demonstrates the OpenCV BGR inversion bug
  invertMask: boolean;       // Inverts foreground / background
}

export interface TelemetryData {
  fps: number;
  frameTimeMs: number;
  alphaCoveragePercent: number;
  engine: 'WebGPU' | 'WASM SIMD' | 'Canvas2D';
  gpuAdapter: string;
  resolution: string;
}

export interface ExportSettings {
  format: 'webm-alpha' | 'png-sequence' | 'png-frame';
  fps: number;
  bitrateBps: number;
  width: number;
  height: number;
}
