import { MattingEngine } from '../engines/matting-engine';
import { VideoSourceManager } from '../components/video-source-manager';
import { CheckerboardViewport } from '../components/checkerboard-viewport';
import { ExportManager } from '../components/export-manager';
import { TelemetryHUD } from '../components/telemetry-hud';
import { BackgroundMode, MattingMode } from '../types';

class TransparentStudioApp {
  private canvas: HTMLCanvasElement;
  private engine: MattingEngine;
  private sourceManager: VideoSourceManager;
  private viewport: CheckerboardViewport;
  private exportManager: ExportManager;
  private telemetryHud: TelemetryHUD;

  private isPlaying = true;
  private animationFrameId = 0;
  private isSmurfActive = false;
  private isSplitActive = false;

  constructor() {
    this.canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
    const viewportContainer = document.getElementById('viewport-container') as HTMLElement;
    const telemetryContainer = document.getElementById('telemetry-container') as HTMLElement;

    this.engine = new MattingEngine(this.canvas);
    this.sourceManager = new VideoSourceManager();
    this.viewport = new CheckerboardViewport(viewportContainer, this.canvas);
    this.exportManager = new ExportManager(this.canvas);
    this.telemetryHud = new TelemetryHUD(telemetryContainer);

    this.setupListeners();
    this.init();
  }

  private async init(): Promise<void> {
    await this.engine.init();

    const adapterNameElem = document.getElementById('gpu-adapter-name');
    if (adapterNameElem) {
      adapterNameElem.textContent = this.engine.getTelemetry().gpuAdapter;
    }

    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const loop = (timestamp: number) => {
      const time = timestamp * 0.001;

      if (this.isPlaying) {
        const sourceType = this.sourceManager.getSourceType();

        if (sourceType === 'demo') {
          // Render procedural presenter
          const demoFrame = this.engine.renderProceduralDemoFrame(time);
          this.engine.processFrame(demoFrame, time);
        } else {
          // Render video element stream
          const video = this.sourceManager.getVideoElement();
          if (video.readyState >= 2) {
            this.engine.processFrame(video, time);
          }
        }

        // Telemetry update
        this.telemetryHud.update(this.engine.getTelemetry());

        // Update timer
        const timerElem = document.getElementById('viewport-timer');
        if (timerElem) {
          const secs = Math.floor(time) % 60;
          const mins = Math.floor(time / 60) % 60;
          const hrs = Math.floor(time / 3600);
          timerElem.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private setupListeners(): void {
    // 1. Source selector buttons
    const sourceBtns = document.querySelectorAll<HTMLButtonElement>('[data-source]');
    const filePicker = document.getElementById('file-picker') as HTMLInputElement;

    sourceBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        sourceBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const source = btn.dataset.source;
        if (source === 'demo') {
          await this.sourceManager.switchToDemo();
        } else if (source === 'webcam') {
          await this.sourceManager.switchToWebcam();
        } else if (source === 'file') {
          filePicker.click();
        } else if (source === 'screen') {
          await this.sourceManager.switchToScreen();
        }
      });
    });

    filePicker.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await this.sourceManager.switchToFile(files[0]);
      }
    });

    // 2. Background mode buttons
    const bgBtns = document.querySelectorAll<HTMLButtonElement>('[data-bg]');
    bgBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        bgBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.engine.setBackgroundMode(btn.dataset.bg as BackgroundMode);
      });
    });

    // 3. Matting mode buttons
    const modeBtns = document.querySelectorAll<HTMLButtonElement>('[data-mode]');
    const colorPickerRow = document.getElementById('color-picker-row');
    const colorInput = document.getElementById('key-color-input') as HTMLInputElement;

    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        modeBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.mode as MattingMode;
        this.engine.setMattingMode(mode);

        if (mode === 'chroma-custom') {
          if (colorPickerRow) colorPickerRow.style.display = 'flex';
        } else {
          if (colorPickerRow) colorPickerRow.style.display = 'none';
        }
      });
    });

    colorInput?.addEventListener('input', (e) => {
      const hex = (e.target as HTMLInputElement).value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this.engine.setParams({ keyColor: [r, g, b] });
    });

    // 4. Edge tuning sliders
    const sliderThreshold = document.getElementById('slider-threshold') as HTMLInputElement;
    const sliderFeather = document.getElementById('slider-feather') as HTMLInputElement;
    const sliderDespill = document.getElementById('slider-despill') as HTMLInputElement;
    const sliderChoke = document.getElementById('slider-choke') as HTMLInputElement;
    const checkInvert = document.getElementById('check-invert') as HTMLInputElement;

    sliderThreshold.addEventListener('input', () => {
      const val = Number(sliderThreshold.value) / 100;
      this.engine.setParams({ threshold: val });
      document.getElementById('val-threshold')!.textContent = `${sliderThreshold.value}%`;
    });

    sliderFeather.addEventListener('input', () => {
      const val = Number(sliderFeather.value) / 100;
      this.engine.setParams({ feather: val });
      document.getElementById('val-feather')!.textContent = `${sliderFeather.value}%`;
    });

    sliderDespill.addEventListener('input', () => {
      const val = Number(sliderDespill.value) / 100;
      this.engine.setParams({ despill: val });
      document.getElementById('val-despill')!.textContent = `${sliderDespill.value}%`;
    });

    sliderChoke.addEventListener('input', () => {
      const val = Number(sliderChoke.value) / 100;
      this.engine.setParams({ choke: val });
      document.getElementById('val-choke')!.textContent = `${sliderChoke.value}%`;
    });

    checkInvert.addEventListener('change', () => {
      this.engine.setParams({ invertMask: checkInvert.checked });
    });

    // 5. Smurf Bug Simulator toggle
    const btnSmurf = document.getElementById('btn-toggle-smurf');
    btnSmurf?.addEventListener('click', () => {
      this.isSmurfActive = !this.isSmurfActive;
      this.engine.setParams({ simulateSmurfBug: this.isSmurfActive });
      btnSmurf.classList.toggle('active-smurf', this.isSmurfActive);
      btnSmurf.textContent = this.isSmurfActive
        ? '🫐 Modo Pitufo ACTIVO (BGR Bug)'
        : '🫐 Simular Efecto Pitufo';
    });

    // 6. Split comparison A/B
    const btnSplit = document.getElementById('btn-toggle-split');
    const splitDivider = document.getElementById('split-divider');

    btnSplit?.addEventListener('click', () => {
      this.isSplitActive = !this.isSplitActive;
      btnSplit.classList.toggle('active', this.isSplitActive);
      if (this.isSplitActive) {
        this.engine.setSplitPosition(0.5);
        if (splitDivider) {
          splitDivider.style.display = 'block';
          splitDivider.style.left = '50%';
        }
      } else {
        this.engine.setSplitPosition(0.0);
        if (splitDivider) splitDivider.style.display = 'none';
      }
    });

    this.viewport.setOnSplitChange((pos) => {
      if (this.isSplitActive) {
        this.engine.setSplitPosition(pos);
        if (splitDivider) {
          splitDivider.style.left = `${pos * 100}%`;
        }
      }
    });

    // 7. Play / Pause & Fullscreen
    const btnPlayPause = document.getElementById('btn-play-pause');
    btnPlayPause?.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      btnPlayPause.innerHTML = this.isPlaying
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 18 12 6 20 6 4"></polygon></svg>';
    });

    const btnFullscreen = document.getElementById('btn-fullscreen');
    btnFullscreen?.addEventListener('click', () => {
      const container = document.getElementById('viewport-container');
      if (!document.fullscreenElement) {
        container?.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    // 8. Snapshot PNG
    const btnSnapshot = document.getElementById('btn-snapshot');
    btnSnapshot?.addEventListener('click', () => {
      this.exportManager.downloadTransparentSnapshot();
    });

    // 9. Record WebM toggle
    const btnRecord = document.getElementById('btn-record-toggle');
    const recLabel = document.getElementById('rec-label');

    btnRecord?.addEventListener('click', () => {
      if (!this.exportManager.isCurrentlyRecording()) {
        const ok = this.exportManager.startRecording(60);
        if (ok) {
          btnRecord.classList.add('recording');
          if (recLabel) recLabel.textContent = 'Detener (00:00)';
        }
      } else {
        this.exportManager.stopRecording();
        btnRecord.classList.remove('recording');
        if (recLabel) recLabel.textContent = 'Grabar WebM Alfa';
      }
    });

    this.exportManager.setOnStateChange((recording, durationSec) => {
      if (recording && recLabel) {
        const mins = String(Math.floor(durationSec / 60)).padStart(2, '0');
        const secs = String(durationSec % 60).padStart(2, '0');
        recLabel.textContent = `Detener (${mins}:${secs})`;
      }
    });
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new TransparentStudioApp();
});
