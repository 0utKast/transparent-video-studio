(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))r(a);new MutationObserver(a=>{for(const s of a)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function e(a){const s={};return a.integrity&&(s.integrity=a.integrity),a.referrerPolicy&&(s.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?s.credentials="include":a.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(a){if(a.ep)return;a.ep=!0;const s=e(a);fetch(a.href,s)}})();const T=`
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Two triangles covering the exact NDC viewport [-1, 1] x [-1, 1]
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );

  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0)
  );

  var out: VertexOutput;
  out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  out.uv = uvs[vertexIndex];
  return out;
}

// Exactly 4 vec4s = 64 bytes with perfect 16-byte WGSL alignment
struct Uniforms {
  tuning: vec4<f32>,       // x: threshold, y: feather, z: despill, w: choke
  keyColor: vec4<f32>,     // x: r, y: g, z: b, w: unused
  modes: vec4<u32>,        // x: mattingMode, y: backgroundMode, z: simulateSmurf, w: invertMask
  misc: vec4<f32>,         // x: time, y: splitPosition, z: resolution.x, w: resolution.y
};

@group(0) @binding(0) var videoTexture: texture_2d<f32>;
@group(0) @binding(1) var videoSampler: sampler;
@group(0) @binding(2) var<uniform> params: Uniforms;

// Helper: RGB to YUV for color distance calculation
fn rgb2yuv(rgb: vec3<f32>) -> vec3<f32> {
  let y = dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
  let u = dot(rgb, vec3<f32>(-0.14713, -0.28886, 0.436));
  let v = dot(rgb, vec3<f32>(0.615, -0.51499, -0.10001));
  return vec3<f32>(y, u, v);
}

// Procedural checkerboard pattern using valid u32 modulo
fn getCheckerboard(uv: vec2<f32>, res: vec2<f32>) -> vec4<f32> {
  let tileSize = 16.0;
  let px = u32(max(0.0, uv.x * res.x / tileSize));
  let py = u32(max(0.0, uv.y * res.y / tileSize));
  let check = f32((px + py) % 2u);
  let c1 = vec3<f32>(0.12, 0.14, 0.18);
  let c2 = vec3<f32>(0.20, 0.22, 0.28);
  return vec4<f32>(mix(c1, c2, check), 1.0);
}

// Virtual Studio Backdrop (Cyberpunk ambient studio)
fn getVirtualStudio(uv: vec2<f32>, time: f32) -> vec4<f32> {
  let horizon = 0.55;
  let ground = smoothstep(horizon - 0.02, horizon + 0.02, uv.y);
  
  let sky = mix(vec3<f32>(0.08, 0.04, 0.18), vec3<f32>(0.25, 0.08, 0.35), uv.y * 1.5);
  let floorColor = mix(vec3<f32>(0.05, 0.06, 0.10), vec3<f32>(0.02, 0.02, 0.04), (uv.y - horizon) / max(1.0 - horizon, 0.01));
  
  let gridX = abs(fract((uv.x - 0.5) / (max(uv.y - horizon, 0.01) * 2.0 + 0.1) * 8.0) - 0.5);
  let gridLine = smoothstep(0.45, 0.48, gridX) * (1.0 - ground);
  let gridGlow = vec3<f32>(0.0, 0.8, 1.0) * gridLine * 0.4;
  
  let base = mix(sky, floorColor + gridGlow, ground);
  return vec4<f32>(base, 1.0);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Use textureSampleLevel with level 0.0 for uniform flow compliance
  var rawColor = textureSampleLevel(videoTexture, videoSampler, uv, 0.0);

  // 1. Efecto Pitufo Simulator (Educational demo for OpenCV BGR bug)
  if (params.modes.z == 1u) {
    let tmpR = rawColor.r;
    rawColor.r = rawColor.b;
    rawColor.b = tmpR;
  }

  // 2. Interactive A/B split screen
  let splitPos = params.misc.y;
  let res = vec2<f32>(params.misc.z, params.misc.w);
  if (splitPos > 0.01 && uv.x < splitPos) {
    // Divider line
    if (abs(uv.x - splitPos) < (2.0 / max(res.x, 1.0))) {
      return vec4<f32>(1.0, 1.0, 1.0, 1.0);
    }
    return rawColor;
  }

  var processedColor = rawColor;
  var alpha = 1.0;

  let thresh = params.tuning.x;
  let feather = params.tuning.y;
  let despill = params.tuning.z;
  let choke = params.tuning.w;
  let keyColor = params.keyColor.xyz;
  let mattingMode = params.modes.x;
  let backgroundMode = params.modes.y;
  let invertMask = params.modes.w;

  // 3. Compute Alpha Matte based on Mode
  if (mattingMode == 0u) {
    // Green Chroma Keying
    let greenDiff = rawColor.g - max(rawColor.r, rawColor.b);
    let t = thresh * 0.4 + 0.02;
    let f = max(feather * 0.3, 0.005);
    alpha = 1.0 - smoothstep(t, t + f, greenDiff);

    // Despill Filter: clamp green to max(red, blue)
    if (rawColor.g > max(rawColor.r, rawColor.b) && despill > 0.0) {
      let targetG = mix(rawColor.g, max(rawColor.r, rawColor.b), despill);
      processedColor.g = targetG;
    }
  } else if (mattingMode == 1u) {
    // Blue Chroma Keying
    let blueDiff = rawColor.b - max(rawColor.r, rawColor.g);
    let t = thresh * 0.4 + 0.02;
    let f = max(feather * 0.3, 0.005);
    alpha = 1.0 - smoothstep(t, t + f, blueDiff);

    // Despill Filter: clamp blue to max(red, green)
    if (rawColor.b > max(rawColor.r, rawColor.g) && despill > 0.0) {
      let targetB = mix(rawColor.b, max(rawColor.r, rawColor.g), despill);
      processedColor.b = targetB;
    }
  } else if (mattingMode == 2u) {
    // Custom Color Distance Keying (YUV space)
    let yuvSample = rgb2yuv(rawColor.rgb);
    let yuvKey = rgb2yuv(keyColor);
    let dist = distance(yuvSample.yz, yuvKey.yz);
    let t = thresh * 0.5 + 0.01;
    let f = max(feather * 0.25, 0.005);
    alpha = smoothstep(t, t + f, dist);
  } else if (mattingMode == 4u) {
    // Luma Keying
    let lum = dot(rawColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
    alpha = smoothstep(thresh - feather * 0.5, thresh + feather * 0.5, lum);
  } else {
    // Procedural / Default
    alpha = rawColor.a;
  }

  // Choke / Expand adjustment
  if (choke != 0.0) {
    alpha = clamp(alpha + choke * 0.25, 0.0, 1.0);
  }

  if (invertMask == 1u) {
    alpha = 1.0 - alpha;
  }

  processedColor.a = alpha;

  // 4. Background Compositing
  var finalColor: vec4<f32>;

  if (backgroundMode == 0u) {
    // Checkerboard Transparency visualization
    let checker = getCheckerboard(uv, res);
    finalColor = vec4<f32>(mix(checker.rgb, processedColor.rgb, alpha), 1.0);
  } else if (backgroundMode == 1u) {
    // Solid Green Screen (#00FF00)
    let greenScreen = vec3<f32>(0.0, 1.0, 0.0);
    finalColor = vec4<f32>(mix(greenScreen, processedColor.rgb, alpha), 1.0);
  } else if (backgroundMode == 2u) {
    // Virtual Studio (Cyberpunk ambient)
    let studio = getVirtualStudio(uv, params.misc.x);
    finalColor = vec4<f32>(mix(studio.rgb, processedColor.rgb, alpha), 1.0);
  } else if (backgroundMode == 3u) {
    // Studio Office / Warm bokeh
    let warmBg = mix(vec3<f32>(0.12, 0.16, 0.24), vec3<f32>(0.28, 0.22, 0.18), uv.x);
    finalColor = vec4<f32>(mix(warmBg, processedColor.rgb, alpha), 1.0);
  } else {
    // Raw Transparent RGBA
    finalColor = vec4<f32>(processedColor.rgb * alpha, alpha);
  }

  return finalColor;
}
`;class R{device=null;adapter=null;context=null;pipeline=null;uniformBuffer=null;sampler=null;videoTexture=null;isSupported=!1;adapterInfo="Inicializando...";targetCanvas;constructor(t){this.targetCanvas=t}async init(){if(!navigator.gpu)return this.adapterInfo="WebGPU no soportado en este navegador",!1;try{if(this.adapter=await navigator.gpu.requestAdapter({powerPreference:"high-performance"}),!this.adapter)return this.adapterInfo="No se encontró un adaptador WebGPU compatible",!1;const t=this.adapter.info||{};if(this.adapterInfo=`${t.vendor||"GPU"} ${t.architecture||""} (${t.description||"Hardware"})`,this.device=await this.adapter.requestDevice({requiredLimits:{maxTextureDimension2D:Math.min(8192,this.adapter.limits.maxTextureDimension2D)}}),this.context=this.targetCanvas.getContext("webgpu"),!this.context)return this.adapterInfo="Error al obtener contexto WebGPU del Canvas",!1;const e=navigator.gpu.getPreferredCanvasFormat();this.context.configure({device:this.device,format:e,alphaMode:"opaque"});const r=this.device.createShaderModule({label:"Matting Shader",code:T}),s=(await r.getCompilationInfo()).messages.filter(i=>i.type==="error");if(s.length>0){const i=s.map(o=>`Línea ${o.lineNum}:${o.linePos} - ${o.message}`).join(`
`);return console.error(`[WebGPU Matting Shader Error]:
`,i),this.adapterInfo="Error de compilación de shader WGSL",!1}return this.pipeline=this.device.createRenderPipeline({label:"Matting Pipeline",layout:"auto",vertex:{module:r,entryPoint:"vs_main"},fragment:{module:r,entryPoint:"fs_main",targets:[{format:e}]},primitive:{topology:"triangle-list"}}),this.sampler=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.uniformBuffer=this.device.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.isSupported=!0,!0}catch(t){return console.warn("Fallo al inicializar WebGPU:",t),this.adapterInfo=`Fallo en WebGPU: ${t?.message||"Error desconocido"}`,this.isSupported=!1,!1}}getAdapterName(){return this.adapterInfo}checkSupported(){return this.isSupported}renderFrame(t,e,r,a,s,i){if(!this.isSupported||!this.device||!this.context||!this.pipeline||!this.sampler||!this.uniformBuffer)return;const o=this.targetCanvas.width>0?this.targetCanvas.width:1280,u=this.targetCanvas.height>0?this.targetCanvas.height:720;(!this.videoTexture||this.videoTexture.width!==o||this.videoTexture.height!==u)&&(this.videoTexture&&this.videoTexture.destroy(),this.videoTexture=this.device.createTexture({size:[o,u,1],format:"rgba8unorm",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}));try{this.device.queue.copyExternalImageToTexture({source:t},{texture:this.videoTexture},[o,u])}catch{return}let c=0;r==="chroma-green"?c=0:r==="chroma-blue"?c=1:r==="chroma-custom"?c=2:r==="difference"?c=3:r==="luma"?c=4:c=5;let n=0;a==="transparent"?n=0:a==="green"?n=1:a==="cyberpunk"?n=2:a==="office"?n=3:n=4;const d=new ArrayBuffer(64),l=new Float32Array(d),w=new Uint32Array(d);l[0]=e.threshold,l[1]=e.feather,l[2]=e.despill,l[3]=e.choke,l[4]=e.keyColor[0]/255,l[5]=e.keyColor[1]/255,l[6]=e.keyColor[2]/255,l[7]=0,w[8]=c,w[9]=n,w[10]=e.simulateSmurfBug?1:0,w[11]=e.invertMask?1:0,l[12]=i,l[13]=s,l[14]=o,l[15]=u,this.device.queue.writeBuffer(this.uniformBuffer,0,d);const f=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.videoTexture.createView()},{binding:1,resource:this.sampler},{binding:2,resource:{buffer:this.uniformBuffer}}]}),p=this.device.createCommandEncoder(),M=this.context.getCurrentTexture(),g=p.beginRenderPass({colorAttachments:[{view:M.createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});g.setPipeline(this.pipeline),g.setBindGroup(0,f),g.draw(6),g.end(),this.device.queue.submit([p.finish()])}}class E{static getSmurfBugExplanation(){return{title:"Auditoría de Integridad Cromática: Prevención del Efecto Pitufo",description:"En aplicaciones clásicas de escritorio con OpenCV (Python / C++), los fotogramas de vídeo se capturan en orden BGR (Azul, Verde, Rojo). Si estos búferes se entregan a redes neuronales o codificadores que esperan RGB/RGBA, el canal azul y el rojo se intercambian, tiñendo los tonos de piel humanos de azul cian intenso.",desktopBug:"cv2.VideoCapture() -> BGR Bytes -> Pipe Stdin FFmpeg (Esperando RGBA) -> ¡Piel Azul Pitufos!",browserSolution:"HTMLVideoElement -> OffscreenCanvas RGBA8 -> WebGPU Texture rgba8unorm -> Cero intercambios de canal."}}static processCanvas2DFallback(t,e,r,a,s,i,o,u){t.drawImage(e,0,0,r,a);const c=t.getImageData(0,0,r,a),n=c.data,d=n.length;let l=0;const w=d/4,f=s.threshold*100+5,p=s.despill,M=s.simulateSmurfBug,g=u>.01?Math.floor(u*r):0;for(let h=0;h<d;h+=4){const k=h/4%r;if(g>0&&k<g)continue;let y=n[h],S=n[h+1],v=n[h+2];if(M){const m=y;y=v,v=m,n[h]=y,n[h+2]=v}let b=255;if(i==="chroma-green"){const m=Math.max(y,v),C=S-m;if(C>f)b=0,l++;else if(C>f*.5){const P=(C-f*.5)/(f*.5);b=Math.round(255*(1-P)),l+=P}S>m&&p>0&&(n[h+1]=Math.round(S*(1-p)+m*p))}else if(i==="chroma-blue"){const m=Math.max(y,S),C=v-m;if(C>f)b=0,l++;else if(C>f*.5){const P=(C-f*.5)/(f*.5);b=Math.round(255*(1-P))}v>m&&p>0&&(n[h+2]=Math.round(v*(1-p)+m*p))}s.invertMask&&(b=255-b),n[h+3]=b}return t.putImageData(c,0,0),{alphaCoverage:Math.round(l/w*100)}}}class B{webgpuPipeline;canvas;fallbackCtx=null;proceduralCanvas;proceduralCtx;params={threshold:.35,feather:.15,despill:.75,choke:0,keyColor:[0,255,0],simulateSmurfBug:!1,invertMask:!1};mattingMode="chroma-green";backgroundMode="transparent";splitPosition=0;frameCount=0;lastFpsTime=performance.now();currentFps=60;lastFrameDurationMs=1;alphaCoverage=0;constructor(t){this.canvas=t,this.webgpuPipeline=new R(t),this.proceduralCanvas=document.createElement("canvas"),this.proceduralCanvas.width=t.width,this.proceduralCanvas.height=t.height,this.proceduralCtx=this.proceduralCanvas.getContext("2d")}async init(){const t=await this.webgpuPipeline.init();return t||(this.fallbackCtx=this.canvas.getContext("2d")),t}setParams(t){this.params={...this.params,...t}}getParams(){return{...this.params}}setMattingMode(t){this.mattingMode=t}setBackgroundMode(t){this.backgroundMode=t}setSplitPosition(t){this.splitPosition=Math.max(0,Math.min(1,t))}getSplitPosition(){return this.splitPosition}renderProceduralDemoFrame(t){const e=this.proceduralCtx,r=this.proceduralCanvas.width,a=this.proceduralCanvas.height;e.fillStyle="#00d632",e.fillRect(0,0,r,a);const s=e.createRadialGradient(r*.5,a*.4,20,r*.5,a*.4,r*.6);s.addColorStop(0,"rgba(0, 255, 70, 0.35)"),s.addColorStop(1,"rgba(0, 180, 40, 0.0)"),e.fillStyle=s,e.fillRect(0,0,r,a);const i=r*.5+Math.sin(t*.8)*25,o=a*.55+Math.cos(t*1.2)*12;e.beginPath(),e.ellipse(i,a*.88,120,25,0,0,Math.PI*2),e.fillStyle="rgba(0, 80, 20, 0.45)",e.fill(),e.beginPath(),e.ellipse(i,o+120,110,140,0,0,Math.PI*2);const u=e.createLinearGradient(i-100,o,i+100,o+200);u.addColorStop(0,"#1e293b"),u.addColorStop(.5,"#334155"),u.addColorStop(1,"#0f172a"),e.fillStyle=u,e.fill(),e.beginPath(),e.moveTo(i-30,o+30),e.lineTo(i,o+75),e.lineTo(i+30,o+30),e.fillStyle="#ea580c",e.fill(),e.beginPath(),e.rect(i-24,o-10,48,55),e.fillStyle="#e0a98b",e.fill(),e.beginPath(),e.ellipse(i,o-60,65,80,0,0,Math.PI*2);const c=e.createRadialGradient(i-15,o-75,10,i,o-60,85);c.addColorStop(0,"#fcd5be"),c.addColorStop(.7,"#e4aa8b"),c.addColorStop(1,"#c88667"),e.fillStyle=c,e.fill(),e.beginPath(),e.ellipse(i,o-105,72,45,0,0,Math.PI),e.fillStyle="#3b2219",e.fill();for(let d=-5;d<=5;d++)e.beginPath(),e.moveTo(i+d*12,o-110),e.quadraticCurveTo(i+d*14+Math.sin(t*3+d)*3,o-135,i+d*10,o-120),e.strokeStyle="#2d1810",e.lineWidth=3,e.stroke();const n=Math.sin(t*2.5)>.96?.1:1;return e.fillStyle="#ffffff",e.beginPath(),e.ellipse(i-22,o-62,10,7*n,0,0,Math.PI*2),e.ellipse(i+22,o-62,10,7*n,0,0,Math.PI*2),e.fill(),e.fillStyle="#2563eb",e.beginPath(),e.arc(i-22,o-62,4*n,0,Math.PI*2),e.arc(i+22,o-62,4*n,0,Math.PI*2),e.fill(),e.beginPath(),e.arc(i,o-35,18,.2,Math.PI-.2),e.strokeStyle="#991b1b",e.lineWidth=3,e.stroke(),this.proceduralCanvas}processFrame(t,e){const r=performance.now();if(this.webgpuPipeline.checkSupported())this.webgpuPipeline.renderFrame(t,this.params,this.mattingMode,this.backgroundMode,this.splitPosition,e),this.alphaCoverage=Math.round(this.params.threshold*60+20);else if(this.fallbackCtx){const s=E.processCanvas2DFallback(this.fallbackCtx,t,this.canvas.width,this.canvas.height,this.params,this.mattingMode,this.backgroundMode,this.splitPosition);this.alphaCoverage=s.alphaCoverage}this.frameCount++;const a=performance.now();this.lastFrameDurationMs=a-r,a-this.lastFpsTime>=1e3&&(this.currentFps=Math.round(this.frameCount*1e3/(a-this.lastFpsTime)),this.frameCount=0,this.lastFpsTime=a)}getTelemetry(){return{fps:this.currentFps,frameTimeMs:Number(this.lastFrameDurationMs.toFixed(2)),alphaCoveragePercent:this.alphaCoverage,engine:this.webgpuPipeline.checkSupported()?"WebGPU":"Canvas2D",gpuAdapter:this.webgpuPipeline.getAdapterName(),resolution:`${this.canvas.width}x${this.canvas.height}`}}}class D{currentSource="demo";videoElement;mediaStream=null;onSourceChanged;constructor(){this.videoElement=document.createElement("video"),this.videoElement.autoplay=!0,this.videoElement.loop=!0,this.videoElement.muted=!0,this.videoElement.playsInline=!0}setSourceCallback(t){this.onSourceChanged=t}getSourceType(){return this.currentSource}getVideoElement(){return this.videoElement}async switchToDemo(){this.stopMediaStream(),this.currentSource="demo",this.onSourceChanged?.("demo")}async switchToWebcam(){this.stopMediaStream();try{this.mediaStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60,min:30}},audio:!1}),this.videoElement.srcObject=this.mediaStream,await this.videoElement.play(),this.currentSource="webcam",this.onSourceChanged?.("webcam")}catch(t){console.error("Error al acceder a la cámara web:",t),alert("No se pudo acceder a la cámara web. Asegúrate de otorgar permisos."),await this.switchToDemo()}}async switchToFile(t){this.stopMediaStream();const e=URL.createObjectURL(t);this.videoElement.srcObject=null,this.videoElement.src=e,await this.videoElement.play(),this.currentSource="file",this.onSourceChanged?.("file")}async switchToScreen(){this.stopMediaStream();try{this.mediaStream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:"browser",frameRate:{ideal:60}},audio:!1}),this.videoElement.srcObject=this.mediaStream,await this.videoElement.play(),this.currentSource="screen",this.onSourceChanged?.("screen"),this.mediaStream.getVideoTracks()[0].onended=()=>{this.switchToDemo()}}catch(t){console.error("Error al capturar pantalla:",t),await this.switchToDemo()}}stopMediaStream(){this.mediaStream&&(this.mediaStream.getTracks().forEach(t=>t.stop()),this.mediaStream=null),this.videoElement.src&&(URL.revokeObjectURL(this.videoElement.src),this.videoElement.src="")}}class I{canvas;mediaRecorder=null;recordedChunks=[];isRecording=!1;onStateChange;recordStartTime=0;recordTimerInterval=0;constructor(t){this.canvas=t}setOnStateChange(t){this.onStateChange=t}isCurrentlyRecording(){return this.isRecording}startRecording(t=60){if(this.isRecording)return!1;try{const e=this.canvas.captureStream(t);let r="video/webm;codecs=vp9";return MediaRecorder.isTypeSupported(r)||(r="video/webm;codecs=vp8"),MediaRecorder.isTypeSupported(r)||(r="video/webm"),this.recordedChunks=[],this.mediaRecorder=new MediaRecorder(e,{mimeType:r,videoBitsPerSecond:1e7}),this.mediaRecorder.ondataavailable=a=>{a.data&&a.data.size>0&&this.recordedChunks.push(a.data)},this.mediaRecorder.onstop=()=>{this.finishDownload()},this.mediaRecorder.start(250),this.isRecording=!0,this.recordStartTime=performance.now(),this.recordTimerInterval=window.setInterval(()=>{const a=Math.floor((performance.now()-this.recordStartTime)/1e3);this.onStateChange?.(!0,a)},500),this.onStateChange?.(!0,0),!0}catch(e){return console.error("Error al iniciar grabación WebM:",e),alert("Error al iniciar la grabación con canal alfa."),!1}}stopRecording(){!this.isRecording||!this.mediaRecorder||(window.clearInterval(this.recordTimerInterval),this.mediaRecorder.stop(),this.isRecording=!1,this.onStateChange?.(!1,0))}finishDownload(){if(this.recordedChunks.length===0)return;const t=new Blob(this.recordedChunks,{type:"video/webm"}),e=URL.createObjectURL(t),r=document.createElement("a");r.href=e,r.download=`video_transparente_${Date.now()}.webm`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(e)}downloadTransparentSnapshot(){this.canvas.toBlob(t=>{if(!t)return;const e=URL.createObjectURL(t),r=document.createElement("a");r.href=e,r.download=`fotograma_transparente_${Date.now()}.png`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(e)},"image/png")}getProRes4444Command(t,e){return`ffmpeg -i "${t}" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le "${e}"`}}export{I as E,B as M,D as V};
