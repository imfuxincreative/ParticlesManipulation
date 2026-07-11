import * as THREE from 'three';

export const GridFloorShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#e91e63') }, // Grid line color
    uGlowIntensity: { value: 2.5 },                 // Line HDR glow intensity
    uOpacity: { value: 0.35 },                      // Grid line base opacity
    uDepthLimit: { value: 40.0 },    // Reveal depth limit (animated)
    uFadeZone: { value: 15.0 },      // Reveal fade zone width
    uTileSize: { value: 4.0 },       // Tile grid size (spacing between lines)
    uLineWidth: { value: 1.0 },      // Line width in screen-space pixels
    uBaseColor: { value: new THREE.Color('#888888') }, // Tile base fill color
    uFillOpacity: { value: 0.15 },                     // Tile base fill opacity
    uBurnOut: { value: 0.0 },
    uSolidDepthLimit: { value: 200.0 },
    uWipeDirection: { value: new THREE.Vector3(1.0, 0.0, 1.0).normalize() },
    uMinProj: { value: -100.0 },
    uMaxProj: { value: 100.0 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying float vDepth;
    
    void main() {
      // Calculate world position
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      // Calculate view-space depth
      vec4 mvPosition = viewMatrix * worldPosition;
      vDepth = -mvPosition.z; // Distance from camera
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uGlowIntensity;
    uniform float uOpacity;
    uniform float uDepthLimit;
    uniform float uFadeZone;
    uniform float uTileSize;
    uniform float uLineWidth;
    
    uniform vec3 uBaseColor;
    uniform float uFillOpacity;
    uniform float uBurnOut;
    uniform float uSolidDepthLimit;
    uniform vec3 uWipeDirection;
    uniform float uMinProj;
    uniform float uMaxProj;
    
    varying vec3 vWorldPosition;
    varying float vDepth;

    // 2D Random hash
    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    // 2D Value Noise
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    // Fractal Brownian Motion (FBM) for natural jagged edge
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      float c = cos(0.5);
      float s = sin(0.5);
      mat2 rot = mat2(c, s, -s, c);
      for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }
    
    void main() {
      // Calculate side-sweeping wipe progress
      float proj = dot(vWorldPosition.xyz, uWipeDirection);
      float progress = clamp((proj - uMinProj) / (uMaxProj - uMinProj), 0.0, 1.0);
      
      // We want a smooth opacity transition zone of width 0.1
      float transitionWidth = 0.1;
      float wipeProgress = uBurnOut * 1.25 - 0.1;
      float alphaFactor = smoothstep(wipeProgress, wipeProgress + transitionWidth, progress);

      // 1. Calculate Grid Lines (Hybrid World/Screen Space)
      vec2 localCoord = abs(fract(vWorldPosition.xz / uTileSize - 0.5) - 0.5) * uTileSize;
      vec2 gridDeriv = fwidth(vWorldPosition.xz);
      vec2 thickness = max(vec2(0.04), uLineWidth * gridDeriv);
      vec2 lineVal = 1.0 - smoothstep(vec2(0.0), thickness, localCoord);
      float lineStrength = max(lineVal.x, lineVal.y);
      
      // 2. Add a soft grid cell/tiled fill pattern (chessboard)
      vec2 tileIndex = floor(vWorldPosition.xz / uTileSize);
      float tileCheck = mod(abs(tileIndex.x + tileIndex.y), 2.0);
      bool isOdd = tileCheck < 0.5;
      float cellFill = isOdd ? uFillOpacity : 0.0;
      
      // 3. X-Ray Reveal (Depth-based) - ONLY applies to grid lines
      float fadeStart = max(0.0, uDepthLimit - uFadeZone);
      float xrayAlpha = 1.0 - smoothstep(fadeStart, uDepthLimit, vDepth);
      float lineAlpha = lineStrength * xrayAlpha * uOpacity;
      
      // Chessboard tiles disappear based on uSolidDepthLimit
      float solidFadeStart = max(0.0, uSolidDepthLimit - uFadeZone);
      float solidXrayAlpha = smoothstep(solidFadeStart, uSolidDepthLimit, vDepth);
      float tileAlpha = cellFill * (1.0 - lineStrength) * solidXrayAlpha;
      
      vec3 baseGridColor = mix(uBaseColor, uColor * uGlowIntensity, lineStrength);
      float baseGridAlpha = max(lineAlpha, tileAlpha);
      
      float scanline = sin(vWorldPosition.z * 2.0 - uTime * 3.0) * 0.5 + 0.5;
      baseGridColor = mix(baseGridColor, baseGridColor * 1.3, scanline * lineStrength * 0.3);
      
      float finalAlpha = baseGridAlpha * alphaFactor;
      if (finalAlpha < 0.001) discard;
      
      gl_FragColor = vec4(baseGridColor, finalAlpha);
    }
  `
};
