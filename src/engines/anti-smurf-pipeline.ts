import { MattingParams } from '../types';

export class AntiSmurfPipeline {
  /**
   * Explanatory breakdown of why the OpenCV "Efecto Pitufo" happened in desktop Python
   * and how BrowserOS guarantees mathematical color space preservation.
   */
  public static getSmurfBugExplanation(): {
    title: string;
    description: string;
    desktopBug: string;
    browserSolution: string;
  } {
    return {
      title: 'Auditoría de Integridad Cromática: Prevención del Efecto Pitufo',
      description:
        'En aplicaciones clásicas de escritorio con OpenCV (Python / C++), los fotogramas de vídeo se capturan en orden BGR (Azul, Verde, Rojo). Si estos búferes se entregan a redes neuronales o codificadores que esperan RGB/RGBA, el canal azul y el rojo se intercambian, tiñendo los tonos de piel humanos de azul cian intenso.',
      desktopBug:
        'cv2.VideoCapture() -> BGR Bytes -> Pipe Stdin FFmpeg (Esperando RGBA) -> ¡Piel Azul Pitufos!',
      browserSolution:
        'HTMLVideoElement -> OffscreenCanvas RGBA8 -> WebGPU Texture rgba8unorm -> Cero intercambios de canal.',
    };
  }

  /**
   * High-performance Canvas2D / Software Fallback Processor
   * Used if WebGPU is unavailable on low-end or virtualized hardware.
   */
  public static processCanvas2DFallback(
    ctx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    width: number,
    height: number,
    params: MattingParams,
    mattingMode: string,
    backgroundMode: string,
    splitPosition: number
  ): { alphaCoverage: number } {
    ctx.drawImage(source, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    let transparentPixels = 0;
    const totalPixels = len / 4;

    const thresh = params.threshold * 100 + 5;
    const despillFactor = params.despill;
    const isSmurfSim = params.simulateSmurfBug;

    const splitPx = splitPosition > 0.01 ? Math.floor(splitPosition * width) : 0;

    for (let i = 0; i < len; i += 4) {
      const pxIndex = i / 4;
      const x = pxIndex % width;

      // Skip processing on the left side if A/B split screen is active
      if (splitPx > 0 && x < splitPx) {
        continue;
      }

      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Simulate OpenCV BGR bug if toggled
      if (isSmurfSim) {
        const tmp = r;
        r = b;
        b = tmp;
        data[i] = r;
        data[i + 2] = b;
      }

      let alpha = 255;

      if (mattingMode === 'chroma-green') {
        const maxRB = Math.max(r, b);
        const greenDiff = g - maxRB;

        if (greenDiff > thresh) {
          alpha = 0;
          transparentPixels++;
        } else if (greenDiff > thresh * 0.5) {
          const ratio = (greenDiff - thresh * 0.5) / (thresh * 0.5);
          alpha = Math.round(255 * (1 - ratio));
          transparentPixels += ratio;
        }

        // Despill filter
        if (g > maxRB && despillFactor > 0) {
          data[i + 1] = Math.round(g * (1 - despillFactor) + maxRB * despillFactor);
        }
      } else if (mattingMode === 'chroma-blue') {
        const maxRG = Math.max(r, g);
        const blueDiff = b - maxRG;

        if (blueDiff > thresh) {
          alpha = 0;
          transparentPixels++;
        } else if (blueDiff > thresh * 0.5) {
          const ratio = (blueDiff - thresh * 0.5) / (thresh * 0.5);
          alpha = Math.round(255 * (1 - ratio));
        }

        if (b > maxRG && despillFactor > 0) {
          data[i + 2] = Math.round(b * (1 - despillFactor) + maxRG * despillFactor);
        }
      }

      if (params.invertMask) {
        alpha = 255 - alpha;
      }

      data[i + 3] = alpha;
    }

    ctx.putImageData(imgData, 0, 0);

    return {
      alphaCoverage: Math.round((transparentPixels / totalPixels) * 100),
    };
  }
}
