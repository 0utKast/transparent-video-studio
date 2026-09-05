export const MATTING_SHADER_WGSL = /* wgsl */ `
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
`;
