export class ExportManager {
  private canvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private onStateChange?: (recording: boolean, durationSec: number) => void;
  private recordStartTime = 0;
  private recordTimerInterval = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public setOnStateChange(cb: (recording: boolean, durationSec: number) => void): void {
    this.onStateChange = cb;
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Starts recording the canvas into a transparent WebM video (VP9 / VP8 with Alpha Channel)
   */
  public startRecording(fps = 60): boolean {
    if (this.isRecording) return false;

    try {
      // Capture 60 FPS stream from canvas with alpha channel support
      const stream = this.canvas.captureStream(fps);

      // Prioritize VP9 with Alpha channel, fallback to standard VP8 WebM
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 10_000_000, // 10 Mbps for crisp edges
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finishDownload();
      };

      this.mediaRecorder.start(250); // Slice every 250ms
      this.isRecording = true;
      this.recordStartTime = performance.now();

      this.recordTimerInterval = window.setInterval(() => {
        const elapsed = Math.floor((performance.now() - this.recordStartTime) / 1000);
        this.onStateChange?.(true, elapsed);
      }, 500);

      this.onStateChange?.(true, 0);
      return true;
    } catch (err) {
      console.error('Error al iniciar grabación WebM:', err);
      alert('Error al iniciar la grabación con canal alfa.');
      return false;
    }
  }

  public stopRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) return;

    window.clearInterval(this.recordTimerInterval);
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.onStateChange?.(false, 0);
  }

  private finishDownload(): void {
    if (this.recordedChunks.length === 0) return;

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_transparente_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Captures an instant high-resolution transparent PNG snapshot
   */
  public downloadTransparentSnapshot(): void {
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fotograma_transparente_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  /**
   * Modal explanation & conversion guide for Apple ProRes 4444 (.mov)
   */
  public getProRes4444Command(inputWebmName: string, outputMovName: string): string {
    return `ffmpeg -i "${inputWebmName}" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le "${outputMovName}"`;
  }
}
