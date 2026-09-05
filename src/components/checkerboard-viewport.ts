export class CheckerboardViewport {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private splitPosition = 0.0;
  private isDragging = false;
  private onSplitChange?: (pos: number) => void;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement) {
    this.container = container;
    this.canvas = canvas;
    this.initSplitEvents();
  }

  public setOnSplitChange(cb: (pos: number) => void): void {
    this.onSplitChange = cb;
  }

  public setSplitPosition(pos: number): void {
    this.splitPosition = Math.max(0.0, Math.min(1.0, pos));
    this.onSplitChange?.(this.splitPosition);
  }

  public getSplitPosition(): number {
    return this.splitPosition;
  }

  private initSplitEvents(): void {
    const handleMove = (clientX: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const normalized = relativeX / rect.width;
      this.setSplitPosition(normalized);
    };

    this.container.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.viewport-controls')) return;
      this.isDragging = true;
      handleMove(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        handleMove(e.clientX);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch support
    this.container.addEventListener('touchstart', (e) => {
      if ((e.target as HTMLElement).closest('.viewport-controls')) return;
      this.isDragging = true;
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }
}
