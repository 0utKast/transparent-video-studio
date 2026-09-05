import { MattingEngine } from '../engines/matting-engine';
import { VideoSourceManager } from '../components/video-source-manager';
import { ExportManager } from '../components/export-manager';
import { BackgroundMode } from '../types';

class SidePanelApp {
  private canvas: HTMLCanvasElement;
  private engine: MattingEngine;
  private sourceManager: VideoSourceManager;
  private exportManager: ExportManager;
  private isSmurfActive = false;

  constructor() {
    this.canvas = document.getElementById('sp-canvas') as HTMLCanvasElement;
    this.engine = new MattingEngine(this.canvas);
    this.sourceManager = new VideoSourceManager();
    this.exportManager = new ExportManager(this.canvas);

    this.setupEvents();
    this.init();
  }

  private async init(): Promise<void> {
    await this.engine.init();
    this.startLoop();
  }

  private startLoop(): void {
    const loop = (timestamp: number) => {
      const time = timestamp * 0.001;
      const source = this.sourceManager.getSourceType();

      if (source === 'demo') {
        const frame = this.engine.renderProceduralDemoFrame(time);
        this.engine.processFrame(frame, time);
      } else {
        const video = this.sourceManager.getVideoElement();
        if (video.readyState >= 2) {
          this.engine.processFrame(video, time);
        }
      }

      const tel = this.engine.getTelemetry();
      const fpsElem = document.getElementById('sp-fps');
      const engElem = document.getElementById('sp-engine');
      if (fpsElem) fpsElem.textContent = `${tel.fps} FPS`;
      if (engElem) engElem.textContent = tel.engine;

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  private setupEvents(): void {
    // Open full studio
    document.getElementById('btn-open-studio')?.addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('studio/index.html'),
      });
    });

    // Sources
    const sourceBtns = document.querySelectorAll<HTMLButtonElement>('.source-btn');
    const filePicker = document.getElementById('sp-file-picker') as HTMLInputElement;

    sourceBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        sourceBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const src = btn.dataset.source;
        if (src === 'demo') await this.sourceManager.switchToDemo();
        else if (src === 'webcam') await this.sourceManager.switchToWebcam();
        else if (src === 'file') filePicker.click();
      });
    });

    filePicker.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await this.sourceManager.switchToFile(files[0]);
      }
    });

    // Backgrounds
    const bgBtns = document.querySelectorAll<HTMLButtonElement>('.bg-btn');
    bgBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        bgBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.engine.setBackgroundMode(btn.dataset.bg as BackgroundMode);
      });
    });

    // Sliders
    const threshSlider = document.getElementById('sp-slider-thresh') as HTMLInputElement;
    const featherSlider = document.getElementById('sp-slider-feather') as HTMLInputElement;
    const despillSlider = document.getElementById('sp-slider-despill') as HTMLInputElement;

    threshSlider.addEventListener('input', () => {
      const val = Number(threshSlider.value) / 100;
      this.engine.setParams({ threshold: val });
      document.getElementById('sp-val-thresh')!.textContent = `${threshSlider.value}%`;
    });

    featherSlider.addEventListener('input', () => {
      const val = Number(featherSlider.value) / 100;
      this.engine.setParams({ feather: val });
      document.getElementById('sp-val-feather')!.textContent = `${featherSlider.value}%`;
    });

    despillSlider.addEventListener('input', () => {
      const val = Number(despillSlider.value) / 100;
      this.engine.setParams({ despill: val });
      document.getElementById('sp-val-despill')!.textContent = `${despillSlider.value}%`;
    });

    // Smurf Checkbox
    const checkSmurf = document.getElementById('sp-check-smurf') as HTMLInputElement;
    checkSmurf.addEventListener('change', () => {
      this.isSmurfActive = checkSmurf.checked;
      this.engine.setParams({ simulateSmurfBug: this.isSmurfActive });
    });

    // Snapshot
    document.getElementById('btn-sp-snapshot')?.addEventListener('click', () => {
      this.exportManager.downloadTransparentSnapshot();
    });

    // Record WebM
    const btnRecord = document.getElementById('btn-sp-record');
    const recLabel = document.getElementById('sp-rec-label');

    btnRecord?.addEventListener('click', () => {
      if (!this.exportManager.isCurrentlyRecording()) {
        const ok = this.exportManager.startRecording(60);
        if (ok) {
          btnRecord.classList.add('recording');
          if (recLabel) recLabel.textContent = 'Detener';
        }
      } else {
        this.exportManager.stopRecording();
        btnRecord.classList.remove('recording');
        if (recLabel) recLabel.textContent = 'Grabar WebM Alfa';
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new SidePanelApp();
});
