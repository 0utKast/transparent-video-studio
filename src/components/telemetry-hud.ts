import { TelemetryData } from '../types';

export class TelemetryHUD {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public update(data: TelemetryData): void {
    const is60 = data.fps >= 55;
    const fpsClass = is60 ? 'status-green' : data.fps >= 30 ? 'status-yellow' : 'status-red';

    this.container.innerHTML = `
      <div class="hud-item">
        <span class="hud-label">FPS:</span>
        <span class="hud-value ${fpsClass}">${data.fps}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Latencia:</span>
        <span class="hud-value">${data.frameTimeMs} ms</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Transparencia:</span>
        <span class="hud-value text-accent">${data.alphaCoveragePercent}%</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Motor:</span>
        <span class="hud-badge ${data.engine === 'WebGPU' ? 'badge-gpu' : 'badge-cpu'}">${data.engine}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Resolución:</span>
        <span class="hud-value">${data.resolution}</span>
      </div>
    `;
  }
}
