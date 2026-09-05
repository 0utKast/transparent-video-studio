import { MattingEngine } from '../engines/matting-engine';
import { VideoSourceManager } from '../components/video-source-manager';
import { CheckerboardViewport } from '../components/checkerboard-viewport';
import { ExportManager } from '../components/export-manager';
import { TelemetryHUD } from '../components/telemetry-hud';
import { BackgroundMode } from '../types';

class TransparentStudioApp {
  private canvas: HTMLCanvasElement;
  private viewportContainer: HTMLElement;
  private engine: MattingEngine;
  private sourceManager: VideoSourceManager;
  private viewport: CheckerboardViewport;
  private exportManager: ExportManager;
  private telemetryHud: TelemetryHUD;

  private isPlaying = true;
  private animationFrameId = 0;
  private isSmurfActive = false;
  private isSplitActive = false;
  private isEyedropperActive = false;

  constructor() {
    this.canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
    this.viewportContainer = document.getElementById('viewport-container') as HTMLElement;
    const telemetryContainer = document.getElementById('telemetry-container') as HTMLElement;

    this.engine = new MattingEngine(this.canvas);
    this.sourceManager = new VideoSourceManager();
    this.viewport = new CheckerboardViewport(this.viewportContainer, this.canvas);
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
      const sourceType = this.sourceManager.getSourceType();
      const video = this.sourceManager.getVideoElement();

      if (this.isPlaying) {
        if (sourceType === 'demo') {
          const demoFrame = this.engine.renderProceduralDemoFrame(time);
          this.engine.processFrame(demoFrame, time);
        } else {
          if (video.readyState >= 2) {
            this.engine.processFrame(video, time);
          }
        }
      }

      // Update video timeline scrubber & durations if file/video is active
      if (sourceType === 'file' && video.duration && !isNaN(video.duration)) {
        const scrubber = document.getElementById('video-scrubber') as HTMLInputElement;
        const timeCur = document.getElementById('time-current');
        const timeDur = document.getElementById('time-duration');

        if (scrubber && !this.isUserSeeking) {
          scrubber.value = String((video.currentTime / video.duration) * 100);
        }
        if (timeCur) timeCur.textContent = this.formatTime(video.currentTime);
        if (timeDur) timeDur.textContent = this.formatTime(video.duration);
      }

      // Telemetry
      this.telemetryHud.update(this.engine.getTelemetry());

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private isUserSeeking = false;

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private setupListeners(): void {
    const helperBanner = document.getElementById('helper-banner');
    const colorDot = document.getElementById('color-preview-dot');
    const colorInput = document.getElementById('key-color-input') as HTMLInputElement;

    // Helper to apply and display picked color
    const applyKeyColor = (r: number, g: number, b: number) => {
      this.engine.setParams({ keyColor: [r, g, b] });
      this.engine.setMattingMode('chroma-custom');

      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      if (colorDot) colorDot.style.backgroundColor = hex;
      if (colorInput) colorInput.value = hex;

      // Unselect preset green/blue buttons
      document.querySelectorAll('.method-btn').forEach((b) => b.classList.remove('active'));
      document.getElementById('btn-method-eyedropper')?.classList.add('active');
    };

    // 1. Cuentagotas Mágico (Interactive Click-to-Pick on Canvas)
    const btnEyedropper = document.getElementById('btn-method-eyedropper');
    btnEyedropper?.addEventListener('click', () => {
      this.isEyedropperActive = !this.isEyedropperActive;
      this.viewportContainer.classList.toggle('eyedropper-mode', this.isEyedropperActive);
      helperBanner?.classList.toggle('eyedropper-active', this.isEyedropperActive);

      if (this.isEyedropperActive) {
        if (helperBanner) helperBanner.innerHTML = '🪄 <strong>Modo Cuentagotas ACTIVO:</strong> Haz clic sobre cualquier punto del fondo del vídeo para volverlo transparente.';
      } else {
        if (helperBanner) helperBanner.innerHTML = '💡 Pulsa en <strong>"🪄 Cuentagotas"</strong> y haz clic en el fondo de tu vídeo para borrarlo.';
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (!this.isEyedropperActive) return;

      const rect = this.canvas.getBoundingClientRect();
      const u = (e.clientX - rect.left) / rect.width;
      const v = (e.clientY - rect.top) / rect.height;

      const sourceType = this.sourceManager.getSourceType();
      const source = sourceType === 'demo'
        ? this.engine.renderProceduralDemoFrame(0)
        : this.sourceManager.getVideoElement();

      const [r, g, b] = this.engine.sampleColorAtUV(u, v, source);
      applyKeyColor(r, g, b);

      // Disable eyedropper after pick
      this.isEyedropperActive = false;
      this.viewportContainer.classList.remove('eyedropper-mode');
      helperBanner?.classList.remove('eyedropper-active');
      if (helperBanner) helperBanner.innerHTML = `✅ <strong>¡Fondo eliminado con éxito!</strong> (Color RGB: ${r}, ${g}, ${b}). Ajusta la <strong>Sensibilidad</strong> para afinar el corte.`;
    });

    // 2. Auto-Detectar Fondo (Automatic Corner & Perimeter Sampling)
    document.getElementById('btn-method-autodetect')?.addEventListener('click', () => {
      const sourceType = this.sourceManager.getSourceType();
      const source = sourceType === 'demo'
        ? this.engine.renderProceduralDemoFrame(0)
        : this.sourceManager.getVideoElement();

      const [r, g, b] = this.engine.autoDetectBackgroundColor(source);
      applyKeyColor(r, g, b);

      if (helperBanner) {
        helperBanner.innerHTML = `⚡ <strong>¡Fondo auto-detectado!</strong> Se ha eliminado el color predominante de las esquinas (RGB: ${r}, ${g}, ${b}).`;
      }
    });

    // 3. Preset Green & Blue buttons
    document.getElementById('btn-method-green')?.addEventListener('click', () => {
      document.querySelectorAll('.method-btn').forEach((b) => b.classList.remove('active'));
      document.getElementById('btn-method-green')?.classList.add('active');
      this.engine.setMattingMode('chroma-green');
      if (colorDot) colorDot.style.backgroundColor = '#00ff00';
      if (helperBanner) helperBanner.innerHTML = '🟩 <strong>Modo Croma Verde activado.</strong> Fondo verde transparente.';
    });

    document.getElementById('btn-method-blue')?.addEventListener('click', () => {
      document.querySelectorAll('.method-btn').forEach((b) => b.classList.remove('active'));
      document.getElementById('btn-method-blue')?.classList.add('active');
      this.engine.setMattingMode('chroma-blue');
      if (colorDot) colorDot.style.backgroundColor = '#0055ff';
      if (helperBanner) helperBanner.innerHTML = '🟦 <strong>Modo Croma Azul activado.</strong> Fondo azul transparente.';
    });

    // Manual color picker input
    colorInput?.addEventListener('input', (e) => {
      const hex = (e.target as HTMLInputElement).value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      applyKeyColor(r, g, b);
    });

    // 4. Sliders (Threshold & Feather)
    const sliderThreshold = document.getElementById('slider-threshold') as HTMLInputElement;
    const sliderFeather = document.getElementById('slider-feather') as HTMLInputElement;
    const sliderDespill = document.getElementById('slider-despill') as HTMLInputElement;
    const sliderChoke = document.getElementById('slider-choke') as HTMLInputElement;
    const checkInvert = document.getElementById('check-invert') as HTMLInputElement;

    sliderThreshold?.addEventListener('input', () => {
      const val = Number(sliderThreshold.value) / 100;
      this.engine.setParams({ threshold: val });
      document.getElementById('val-threshold')!.textContent = `${sliderThreshold.value}%`;
    });

    sliderFeather?.addEventListener('input', () => {
      const val = Number(sliderFeather.value) / 100;
      this.engine.setParams({ feather: val });
      document.getElementById('val-feather')!.textContent = `${sliderFeather.value}%`;
    });

    sliderDespill?.addEventListener('input', () => {
      const val = Number(sliderDespill.value) / 100;
      this.engine.setParams({ despill: val });
      document.getElementById('val-despill')!.textContent = `${sliderDespill.value}%`;
    });

    sliderChoke?.addEventListener('input', () => {
      const val = Number(sliderChoke.value) / 100;
      this.engine.setParams({ choke: val });
      document.getElementById('val-choke')!.textContent = `${sliderChoke.value}%`;
    });

    checkInvert?.addEventListener('change', () => {
      this.engine.setParams({ invertMask: checkInvert.checked });
    });

    // 5. Background modes
    const bgBtns = document.querySelectorAll<HTMLButtonElement>('[data-bg]');
    bgBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        bgBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.engine.setBackgroundMode(btn.dataset.bg as BackgroundMode);
      });
    });

    // 6. Video Source & 4K Upload
    const filePicker = document.getElementById('file-picker') as HTMLInputElement;
    document.getElementById('btn-load-file')?.addEventListener('click', () => {
      filePicker.click();
    });

    filePicker.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await this.sourceManager.switchToFile(files[0]);

        document.querySelectorAll('.source-bar .btn').forEach((b) => b.classList.remove('active'));
        document.getElementById('btn-load-file')?.classList.add('active');

        // Suggest auto-detecting or using eyedropper
        if (helperBanner) {
          helperBanner.innerHTML = '📁 <strong>Vídeo cargado con éxito.</strong> Ahora usa el <strong>Cuentagotas</strong> para hacer clic en el fondo que quieras hacer transparente.';
        }
      }
    });

    const sourceBtns = document.querySelectorAll<HTMLButtonElement>('[data-source]');
    sourceBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.source-bar .btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const src = btn.dataset.source;
        if (src === 'demo') {
          await this.sourceManager.switchToDemo();
        } else if (src === 'webcam') {
          await this.sourceManager.switchToWebcam();
        }
      });
    });

    // 7. Video Player Controls (Play/Pause & Scrubber)
    const btnPlayPause = document.getElementById('btn-play-pause');
    const playIcon = document.getElementById('play-icon');
    const video = this.sourceManager.getVideoElement();

    btnPlayPause?.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      if (this.sourceManager.getSourceType() === 'file') {
        if (this.isPlaying) {
          video.play();
        } else {
          video.pause();
        }
      }

      if (playIcon) {
        playIcon.innerHTML = this.isPlaying
          ? '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>'
          : '<polygon points="6 4 18 12 6 20 6 4"></polygon>';
      }
    });

    const scrubber = document.getElementById('video-scrubber') as HTMLInputElement;
    scrubber?.addEventListener('mousedown', () => { this.isUserSeeking = true; });
    scrubber?.addEventListener('mouseup', () => { this.isUserSeeking = false; });
    scrubber?.addEventListener('input', () => {
      if (video.duration) {
        video.currentTime = (Number(scrubber.value) / 100) * video.duration;
      }
    });

    // 8. Interactive Split A/B Comparison
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
        if (splitDivider) splitDivider.style.left = `${pos * 100}%`;
      }
    });

    // 9. Fullscreen
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        this.viewportContainer.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    // 10. Smurf Bug Simulator Toggle
    const btnSmurf = document.getElementById('btn-toggle-smurf');
    btnSmurf?.addEventListener('click', () => {
      this.isSmurfActive = !this.isSmurfActive;
      this.engine.setParams({ simulateSmurfBug: this.isSmurfActive });
      btnSmurf.classList.toggle('btn-primary', this.isSmurfActive);
      btnSmurf.textContent = this.isSmurfActive
        ? '🫐 Modo Pitufo ACTIVO (Error BGR OpenCV)'
        : '🫐 Probar Efecto Pitufo (Demo BGR)';
    });

    // 11. Snapshot PNG
    const triggerSnapshot = () => {
      this.exportManager.downloadTransparentSnapshot();
    };
    document.getElementById('btn-snapshot')?.addEventListener('click', triggerSnapshot);
    document.getElementById('btn-export-snapshot')?.addEventListener('click', triggerSnapshot);

    // 12. Record WebM Video with Alpha
    const toggleRecord = () => {
      const btnHeaderRec = document.getElementById('btn-record-toggle');
      const btnMainExport = document.getElementById('btn-export-main');
      const recLabel = document.getElementById('rec-label');

      if (!this.exportManager.isCurrentlyRecording()) {
        const ok = this.exportManager.startRecording(60);
        if (ok) {
          btnHeaderRec?.classList.add('recording');
          if (btnMainExport) btnMainExport.textContent = '⏹️ Detener y Descargar Vídeo (00:00)';
          if (recLabel) recLabel.textContent = 'Detener (00:00)';
        }
      } else {
        this.exportManager.stopRecording();
        btnHeaderRec?.classList.remove('recording');
        if (btnMainExport) btnMainExport.textContent = '⬇️ Grabar y Descargar Vídeo Transparente';
        if (recLabel) recLabel.textContent = 'Grabar Vídeo Transparente';
      }
    };

    document.getElementById('btn-record-toggle')?.addEventListener('click', toggleRecord);
    document.getElementById('btn-export-main')?.addEventListener('click', toggleRecord);

    this.exportManager.setOnStateChange((recording, durationSec) => {
      const btnMainExport = document.getElementById('btn-export-main');
      const recLabel = document.getElementById('rec-label');
      if (recording) {
        const mins = String(Math.floor(durationSec / 60)).padStart(2, '0');
        const secs = String(durationSec % 60).padStart(2, '0');
        const timeStr = `(${mins}:${secs})`;
        if (btnMainExport) btnMainExport.textContent = `⏹️ Detener y Descargar Vídeo ${timeStr}`;
        if (recLabel) recLabel.textContent = `Detener ${timeStr}`;
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TransparentStudioApp();
});
