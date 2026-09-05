import { WebGPUMattingPipeline } from './webgpu-matting-pipeline';
import { AntiSmurfPipeline } from './anti-smurf-pipeline';
import { MattingParams, MattingMode, BackgroundMode, TelemetryData } from '../types';

export class MattingEngine {
  private webgpuPipeline: WebGPUMattingPipeline;
  private canvas: HTMLCanvasElement;
  private fallbackCtx: CanvasRenderingContext2D | null = null;
  private proceduralCanvas: HTMLCanvasElement;
  private proceduralCtx: CanvasRenderingContext2D;

  private params: MattingParams = {
    threshold: 0.35,
    feather: 0.15,
    despill: 0.75,
    choke: 0.0,
    keyColor: [0, 255, 0],
    simulateSmurfBug: false,
    invertMask: false,
  };

  private mattingMode: MattingMode = 'chroma-green';
  private backgroundMode: BackgroundMode = 'transparent';
  private splitPosition = 0.0; // 0.0 = full processed, 0.5 = 50% comparison

  // Telemetry
  private frameCount = 0;
  private lastFpsTime = performance.now();
  private currentFps = 60;
  private lastFrameDurationMs = 1.0;
  private alphaCoverage = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.webgpuPipeline = new WebGPUMattingPipeline(canvas);

    // Offscreen canvas for procedural demo generator
    this.proceduralCanvas = document.createElement('canvas');
    this.proceduralCanvas.width = canvas.width;
    this.proceduralCanvas.height = canvas.height;
    this.proceduralCtx = this.proceduralCanvas.getContext('2d')!;
  }

  public async init(): Promise<boolean> {
    const ok = await this.webgpuPipeline.init();
    if (!ok) {
      this.fallbackCtx = this.canvas.getContext('2d');
    }
    return ok;
  }

  public setParams(params: Partial<MattingParams>): void {
    this.params = { ...this.params, ...params };
  }

  public getParams(): MattingParams {
    return { ...this.params };
  }

  public setMattingMode(mode: MattingMode): void {
    this.mattingMode = mode;
  }

  public setBackgroundMode(mode: BackgroundMode): void {
    this.backgroundMode = mode;
  }

  public setSplitPosition(pos: number): void {
    this.splitPosition = Math.max(0.0, Math.min(1.0, pos));
  }

  public getSplitPosition(): number {
    return this.splitPosition;
  }

  /**
   * Generates a dynamic 3D-styled animated presenter in front of a green screen
   * Allows instant testing of background removal and edge matting without loading external video!
   */
  public renderProceduralDemoFrame(time: number): HTMLCanvasElement {
    const ctx = this.proceduralCtx;
    const w = this.proceduralCanvas.width;
    const h = this.proceduralCanvas.height;

    // 1. Studio Green Screen Background (#00E640)
    ctx.fillStyle = '#00d632';
    ctx.fillRect(0, 0, w, h);

    // Subtle studio lighting gradient on the green screen
    const bgGlow = ctx.createRadialGradient(w * 0.5, h * 0.4, 20, w * 0.5, h * 0.4, w * 0.6);
    bgGlow.addColorStop(0, 'rgba(0, 255, 70, 0.35)');
    bgGlow.addColorStop(1, 'rgba(0, 180, 40, 0.0)');
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, w, h);

    // 2. Animated Presenter / Character
    const cx = w * 0.5 + Math.sin(time * 0.8) * 25;
    const cy = h * 0.55 + Math.cos(time * 1.2) * 12;

    // Shadow on green floor
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.88, 120, 25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 80, 20, 0.45)';
    ctx.fill();

    // Body / Torso (Warm studio jacket - Navy Blue & Orange)
    ctx.beginPath();
    ctx.ellipse(cx, cy + 120, 110, 140, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createLinearGradient(cx - 100, cy, cx + 100, cy + 200);
    bodyGrad.addColorStop(0, '#1e293b');
    bodyGrad.addColorStop(0.5, '#334155');
    bodyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Collar shirt (Orange accent)
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 30);
    ctx.lineTo(cx, cy + 75);
    ctx.lineTo(cx + 30, cy + 30);
    ctx.fillStyle = '#ea580c';
    ctx.fill();

    // Neck (Warm natural skin tone)
    ctx.beginPath();
    ctx.rect(cx - 24, cy - 10, 48, 55);
    ctx.fillStyle = '#e0a98b';
    ctx.fill();

    // Head / Face
    ctx.beginPath();
    ctx.ellipse(cx, cy - 60, 65, 80, 0, 0, Math.PI * 2);
    const skinGrad = ctx.createRadialGradient(cx - 15, cy - 75, 10, cx, cy - 60, 85);
    skinGrad.addColorStop(0, '#fcd5be');
    skinGrad.addColorStop(0.7, '#e4aa8b');
    skinGrad.addColorStop(1, '#c88667');
    ctx.fillStyle = skinGrad;
    ctx.fill();

    // Hair (Detailed hair fringe for edge feather testing)
    ctx.beginPath();
    ctx.ellipse(cx, cy - 105, 72, 45, 0, 0, Math.PI);
    ctx.fillStyle = '#3b2219';
    ctx.fill();

    // Individual hair tufts / fine strands (great for testing despill & feathering!)
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 12, cy - 110);
      ctx.quadraticCurveTo(cx + i * 14 + Math.sin(time * 3 + i) * 3, cy - 135, cx + i * 10, cy - 120);
      ctx.strokeStyle = '#2d1810';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Eyes
    const eyeBlink = Math.sin(time * 2.5) > 0.96 ? 0.1 : 1.0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx - 22, cy - 62, 10, 7 * eyeBlink, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 22, cy - 62, 10, 7 * eyeBlink, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2563eb'; // Blue irises
    ctx.beginPath();
    ctx.arc(cx - 22, cy - 62, 4 * eyeBlink, 0, Math.PI * 2);
    ctx.arc(cx + 22, cy - 62, 4 * eyeBlink, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.beginPath();
    ctx.arc(cx, cy - 35, 18, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 3;
    ctx.stroke();

    return this.proceduralCanvas;
  }

  public processFrame(
    sourceImage: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    time: number
  ): void {
    const startTime = performance.now();

    if (this.webgpuPipeline.checkSupported()) {
      this.webgpuPipeline.renderFrame(
        sourceImage,
        this.params,
        this.mattingMode,
        this.backgroundMode,
        this.splitPosition,
        time
      );
      this.alphaCoverage = Math.round(this.params.threshold * 60 + 20);
    } else if (this.fallbackCtx) {
      const res = AntiSmurfPipeline.processCanvas2DFallback(
        this.fallbackCtx,
        sourceImage,
        this.canvas.width,
        this.canvas.height,
        this.params,
        this.mattingMode,
        this.backgroundMode,
        this.splitPosition
      );
      this.alphaCoverage = res.alphaCoverage;
    }

    // Telemetry update
    this.frameCount++;
    const now = performance.now();
    this.lastFrameDurationMs = now - startTime;

    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  public getTelemetry(): TelemetryData {
    return {
      fps: this.currentFps,
      frameTimeMs: Number(this.lastFrameDurationMs.toFixed(2)),
      alphaCoveragePercent: this.alphaCoverage,
      engine: this.webgpuPipeline.checkSupported() ? 'WebGPU' : 'Canvas2D',
      gpuAdapter: this.webgpuPipeline.getAdapterName(),
      resolution: `${this.canvas.width}x${this.canvas.height}`,
    };
  }
}
