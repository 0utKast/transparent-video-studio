import { SourceType } from '../types';

export class VideoSourceManager {
  private currentSource: SourceType = 'demo';
  private videoElement: HTMLVideoElement;
  private mediaStream: MediaStream | null = null;
  private onSourceChanged?: (source: SourceType) => void;

  constructor() {
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.loop = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
  }

  public setSourceCallback(cb: (source: SourceType) => void): void {
    this.onSourceChanged = cb;
  }

  public getSourceType(): SourceType {
    return this.currentSource;
  }

  public getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  public async switchToDemo(): Promise<void> {
    this.stopMediaStream();
    this.currentSource = 'demo';
    this.onSourceChanged?.('demo');
  }

  public async switchToWebcam(): Promise<void> {
    this.stopMediaStream();
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60, min: 30 },
        },
        audio: false,
      });

      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();
      this.currentSource = 'webcam';
      this.onSourceChanged?.('webcam');
    } catch (err) {
      console.error('Error al acceder a la cámara web:', err);
      alert('No se pudo acceder a la cámara web. Asegúrate de otorgar permisos.');
      await this.switchToDemo();
    }
  }

  public async switchToFile(file: File): Promise<void> {
    this.stopMediaStream();
    const url = URL.createObjectURL(file);
    this.videoElement.srcObject = null;
    this.videoElement.src = url;
    await this.videoElement.play();
    this.currentSource = 'file';
    this.onSourceChanged?.('file');
  }

  public async switchToScreen(): Promise<void> {
    this.stopMediaStream();
    try {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          frameRate: { ideal: 60 },
        },
        audio: false,
      });

      this.videoElement.srcObject = this.mediaStream;
      await this.videoElement.play();
      this.currentSource = 'screen';
      this.onSourceChanged?.('screen');

      this.mediaStream.getVideoTracks()[0].onended = () => {
        this.switchToDemo();
      };
    } catch (err) {
      console.error('Error al capturar pantalla:', err);
      await this.switchToDemo();
    }
  }

  private stopMediaStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.videoElement.src) {
      URL.revokeObjectURL(this.videoElement.src);
      this.videoElement.src = '';
    }
  }
}
