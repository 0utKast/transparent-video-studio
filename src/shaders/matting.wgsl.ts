export const MATTING_SHADER_WGSL = `
struct Uniforms {
  threshold: f32,
  feather: f32,
  despill: f32,
  choke: f32,
  keyColor: vec3<f32>,
  mattingMode: u32,
  backgroundMode: u32,
  simulateSmurf: u32,
  invertMask: u32,
  time: f32,
  splitPosition: f32,
  resolution: vec2<f32>,
};

@group(0) @binding(0) var videoTexture: texture_2d<f32>;
@group(0) @binding(1) var videoSampler: sampler;
@group(0) @binding(2) var<uniform> params: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  // Generates a full-screen triangle: (0,0), (2,0), (0,2) in UV space
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 3.0, -1.0),
    vec2<f32>(-1.0,  3.0)
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0)
  );

  var output: VertexOutput;
  output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

// Helper: RGB to YUV for perceptual distance
fn rgb2yuv(rgb: vec3<f32>) -> vec3<f32> {
  let y = dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
  let u = dot(rgb, vec3<f32>(-0.14713, -0.28886, 0.436));
  let v = dot(rgb, vec3<f32>(0.615, -0.51499, -0.10001));
  return vec3<f32>(y, u, v);
}

// Procedural checkerboard pattern for displaying transparency
fn getCheckerboard(uv: vec2<f32>, res: vec2<f32>) -> vec4<f32> {
  let tileSize = 16.0;
  let pixelCoords = uv * res;
  let check = (floor(pixelCoords.x / tileSize) + floor(pixelCoords.y / tileSize)) % 2.0;
  let c1 = vec3<f32>(0.12, 0.13, 0.16);
  let c2 = vec3<f32>(0.20, 0.22, 0.26);
  return vec4<f32>(mix(c1, c2, check), 1.0);
}

// Virtual Studio Backdrop (Cyberpunk ambient studio)
fn getVirtualStudio(uv: vec2<f32>, time: f32) -> vec4<f32> {
  let horizon = 0.55;
  let ground = smoothstep(horizon - 0.02, horizon + 0.02, uv.y);
  
  // Cyberpunk neon gradient background
  let sky = mix(vec3<f32>(0.08, 0.04, 0.18), vec3<f32>(0.25, 0.08, 0.35), uv.y * 1.5);
  let floorColor = mix(vec3<f32>(0.05, 0.06, 0.10), vec3<f32>(0.02, 0.02, 0.04), (uv.y - horizon) / (1.0 - horizon));
  
  // Ambient neon grid lines on the floor
  let gridX = abs(fract((uv.x - 0.5) / (max(uv.y - horizon, 0.01) * 2.0 + 0.1) * 8.0) - 0.5);
  let gridLine = smoothstep(0.45, 0.48, gridX) * (1.0 - ground);
  let gridGlow = vec3<f32>(0.0, 0.8, 1.0) * gridLine * 0.4;
  
  let base = mix(sky, floorColor + gridGlow, ground);
  return vec4<f32>(base, 1.0);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Flip Y for standard video texture coordinates if needed
  let sampleUV = vec2<f32>(uv.x, 1.0 - uv.y);
  var rawColor = textureSample(videoTexture, videoSampler, sampleUV);

  // 1. Efecto Pitufo Simulator (Educational demo)
  // When active, swaps Red and Blue channels to demonstrate the OpenCV BGR bug
  if (params.simulateSmurf == 1u) {
    let tmpR = rawColor.r;
    rawColor.r = rawColor.b;
    rawColor.b = tmpR;
  }

  // 2. Interactive A/B split screen
  // Left side shows raw video, Right side shows processed transparent result
  if (params.splitPosition > 0.01 && uv.x < params.splitPosition) {
    // Thin divider line
    if (abs(uv.x - params.splitPosition) < (2.0 / params.resolution.x)) {
      return vec4<f32>(1.0, 1.0, 1.0, 1.0);
    }
    return rawColor;
  }

  var processedColor = rawColor;
  var alpha = 1.0;

  // 3. Compute Alpha Matte based on Mode
  if (params.mattingMode == 0u) {
    // Mode 0: Green Chroma Keying
    let greenDiff = rawColor.g - max(rawColor.r, rawColor.b);
    let thresh = params.threshold * 0.4 + 0.02;
    let feath = max(params.feather * 0.3, 0.005);
    alpha = 1.0 - smoothstep(thresh, thresh + feath, greenDiff);

    // Despill Filter: clamp green to max(red, blue)
    if (rawColor.g > max(rawColor.r, rawColor.b) && params.despill > 0.0) {
      let targetG = mix(rawColor.g, max(rawColor.r, rawColor.b), params.despill);
      processedColor.g = targetG;
    }
  } else if (params.mattingMode == 1u) {
    // Mode 1: Blue Chroma Keying
    let blueDiff = rawColor.b - max(rawColor.r, rawColor.g);
    let thresh = params.threshold * 0.4 + 0.02;
    let feath = max(params.feather * 0.3, 0.005);
    alpha = 1.0 - smoothstep(thresh, thresh + feath, blueDiff);

    // Despill Filter: clamp blue to max(red, green)
    if (rawColor.b > max(rawColor.r, rawColor.g) && params.despill > 0.0) {
      let targetB = mix(rawColor.b, max(rawColor.r, rawColor.g), params.despill);
      processedColor.b = targetB;
    }
  } else if (params.mattingMode == 2u) {
    // Mode 2: Custom Color Distance Keying (YUV space)
    let yuvSample = rgb2yuv(rawColor.rgb);
    let yuvKey = rgb2yuv(params.keyColor);
    let dist = distance(yuvSample.yz, yuvKey.yz);
    let thresh = params.threshold * 0.5 + 0.01;
    let feath = max(params.feather * 0.25, 0.005);
    alpha = smoothstep(thresh, thresh + feath, dist);
  } else if (params.mattingMode == 4u) {
    // Mode 4: Luma Keying (high/low luminance cut)
    let lum = dot(rawColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
    alpha = smoothstep(params.threshold - params.feather * 0.5, params.threshold + params.feather * 0.5, lum);
  } else {
    // Mode 3 / 5: Semantic & Procedural (use raw alpha or subtle edge mask)
    alpha = rawColor.a;
  }

  // Choke / Expand adjustment
  if (params.choke != 0.0) {
    alpha = clamp(alpha + params.choke * 0.25, 0.0, 1.0);
  }

  if (params.invertMask == 1u) {
    alpha = 1.0 - alpha;
  }

  processedColor.a = alpha;

  // 4. Background Compositing
  var finalColor: vec4<f32>;

  if (params.backgroundMode == 0u) {
    // Checkerboard Transparency visualization
    let checker = getCheckerboard(uv, params.resolution);
    finalColor = vec4<f32>(mix(checker.rgb, processedColor.rgb, alpha), 1.0);
  } else if (params.backgroundMode == 1u) {
    // Solid Green Screen (#00FF00) for traditional pipelines
    let greenScreen = vec3<f32>(0.0, 1.0, 0.0);
    finalColor = vec4<f32>(mix(greenScreen, processedColor.rgb, alpha), 1.0);
  } else if (params.backgroundMode == 2u) {
    // Virtual Studio (Cyberpunk ambient)
    let studio = getVirtualStudio(uv, params.time);
    finalColor = vec4<f32>(mix(studio.rgb, processedColor.rgb, alpha), 1.0);
  } else if (params.backgroundMode == 3u) {
    // Studio Office / Warm bokeh backdrop
    let warmBg = mix(vec3<f32>(0.12, 0.16, 0.24), vec3<f32>(0.28, 0.22, 0.18), uv.x);
    finalColor = vec4<f32>(mix(warmBg, processedColor.rgb, alpha), 1.0);
  } else {
    // Raw Transparent RGBA (Direct Alpha preservation for WebM encoding / PNG export)
    finalColor = vec4<f32>(processedColor.rgb * alpha, alpha);
  }

  return finalColor;
}
`;
