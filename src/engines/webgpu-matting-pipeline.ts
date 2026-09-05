import { MATTING_SHADER_WGSL } from '../shaders/matting.wgsl';
import { MattingParams, BackgroundMode, MattingMode } from '../types';

export class WebGPUMattingPipeline {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private videoTexture: GPUTexture | null = null;
  private isSupported = false;
  private adapterInfo = 'Inicializando...';
  private targetCanvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.targetCanvas = canvas;
  }

  public async init(): Promise<boolean> {
    if (!navigator.gpu) {
      this.adapterInfo = 'WebGPU no soportado en este navegador';
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!this.adapter) {
        this.adapterInfo = 'No se encontró un adaptador WebGPU compatible';
        return false;
      }

      const info = await this.adapter.requestAdapterInfo();
      this.adapterInfo = `${info.vendor || 'GPU'} ${info.architecture || ''} (${info.description || 'Hardware'})`;

      this.device = await this.adapter.requestDevice();
      this.context = this.targetCanvas.getContext('webgpu') as GPUCanvasContext;

      if (!this.context) {
        this.adapterInfo = 'Error al obtener contexto WebGPU del Canvas';
        return false;
      }

      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      });

      // Shader module
      const shaderModule = this.device.createShaderModule({
        label: 'Matting Shader',
        code: MATTING_SHADER_WGSL,
      });

      // Pipeline layout & pipeline
      this.pipeline = this.device.createRenderPipeline({
        label: 'Matting Pipeline',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format: canvasFormat,
              blend: {
                color: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      // Sampler with bilinear filtering
      this.sampler = this.device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
      });

      // Uniform buffer (aligned to 64 bytes)
      // struct: 4 floats + 3 floats keyColor + 1 pad + 4 u32s + 2 floats + 2 floats res = 16 words = 64 bytes
      this.uniformBuffer = this.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      this.isSupported = true;
      return true;
    } catch (err) {
      console.warn('Fallo al inicializar WebGPU:', err);
      this.adapterInfo = 'Fallo en inicialización WebGPU (usando Canvas 2D fallback)';
      this.isSupported = false;
      return false;
    }
  }

  public getAdapterName(): string {
    return this.adapterInfo;
  }

  public checkSupported(): boolean {
    return this.isSupported;
  }

  public renderFrame(
    source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
    params: MattingParams,
    mattingMode: MattingMode,
    backgroundMode: BackgroundMode,
    splitPosition: number,
    time: number
  ): void {
    if (!this.isSupported || !this.device || !this.context || !this.pipeline || !this.sampler || !this.uniformBuffer) {
      return;
    }

    const width = this.targetCanvas.width;
    const height = this.targetCanvas.height;

    // 1. Create or update video texture
    if (!this.videoTexture || this.videoTexture.width !== width || this.videoTexture.height !== height) {
      if (this.videoTexture) this.videoTexture.destroy();
      this.videoTexture = this.device.createTexture({
        size: [width, height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    // Copy source frame to WebGPU texture (RGBA format strictly guaranteed)
    try {
      this.device.queue.copyExternalImageToTexture(
        { source },
        { texture: this.videoTexture },
        [width, height]
      );
    } catch (e) {
      return;
    }

    // 2. Map matting & background mode to integers
    let modeCode = 0;
    if (mattingMode === 'chroma-green') modeCode = 0;
    else if (mattingMode === 'chroma-blue') modeCode = 1;
    else if (mattingMode === 'chroma-custom') modeCode = 2;
    else if (mattingMode === 'difference') modeCode = 3;
    else if (mattingMode === 'luma') modeCode = 4;
    else modeCode = 5;

    let bgCode = 0;
    if (backgroundMode === 'transparent') bgCode = 0;
    else if (backgroundMode === 'green') bgCode = 1;
    else if (backgroundMode === 'cyberpunk') bgCode = 2;
    else if (backgroundMode === 'office') bgCode = 3;
    else bgCode = 4;

    // 3. Write uniform buffer
    const uniformArray = new ArrayBuffer(64);
    const floatView = new Float32Array(uniformArray);
    const uintView = new Uint32Array(uniformArray);

    floatView[0] = params.threshold;
    floatView[1] = params.feather;
    floatView[2] = params.despill;
    floatView[3] = params.choke;

    floatView[4] = params.keyColor[0] / 255.0;
    floatView[5] = params.keyColor[1] / 255.0;
    floatView[6] = params.keyColor[2] / 255.0;
    floatView[7] = 0.0; // padding

    uintView[8] = modeCode;
    uintView[9] = bgCode;
    uintView[10] = params.simulateSmurfBug ? 1 : 0;
    uintView[11] = params.invertMask ? 1 : 0;

    floatView[12] = time;
    floatView[13] = splitPosition;
    floatView[14] = width;
    floatView[15] = height;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

    // 4. Bind group
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.videoTexture.createView() },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });

    // 5. Render pass
    const commandEncoder = this.device.createCommandEncoder();
    const currentTexture = this.context.getCurrentTexture();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentTexture.createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3); // Full-screen triangle
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
