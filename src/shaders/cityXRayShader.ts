import * as THREE from 'three';

export const CityXRayShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x888888) },
    uGlowColor: { value: new THREE.Color(0xffffff) },
    uOpacity: { value: 1.0 },
    uFillOpacity: { value: 0.15 },
    uScanLineSpeed: { value: 1.5 },
    uScanLineDensity: { value: 10.0 },
    uScanLineIntensity: { value: 0.0 },
    uFresnelPower: { value: 2.5 },
    uMouseWorld: { value: new THREE.Vector3(0, 0, 0) },
    uHoverColor: { value: new THREE.Color(0xe91e63) },
    uHoverRadius: { value: 10.0 },
    uHoverActive: { value: 0.0 },
    uBurnOut: { value: 0.0 },
    uWipeDirection: { value: new THREE.Vector3(1.0, 0.0, 1.0).normalize() },
    uMinProj: { value: -100.0 },
    uMaxProj: { value: 100.0 },
    uClipY: { value: 0.0 },
    uClipSide: { value: 0.0 },
    uHazeColor: { value: new THREE.Color(0x0b0c10) },
    uDepthLimit: { value: 200.0 },
    uFadeZone: { value: 30.0 },
    uShowFog: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0x0b0c10) },
    uFogNear: { value: 15.0 },
    uFogFar: { value: 80.0 },
    uFogAmount: { value: 1.0 },
    uGlitchActive: { value: 0.0 },
    uGlitchSeed: { value: 0.0 },
    uTransitionProgress: { value: 0.0 },
    uSceneIndex: { value: 0.0 },
    uActiveSceneIndex: { value: 0.0 },
  },
  vertexShader: `
    #include <skinning_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    varying vec3 vWorldPosition;
    varying float vDepth;
    varying vec4 vScreenPos;
    uniform float uTime;
    
    void main() {
      #include <skinbase_vertex>

      // Start with local-space position & normal
      vec3 transformed = position;
      vec3 objectNormal = normal;

      // Apply bone transforms if this is a SkinnedMesh
      #ifdef USE_SKINNING
        #include <skinning_vertex>
        #include <skinnormal_vertex>
      #endif

      // Normal in view space
      vNormal = normalize(normalMatrix * objectNormal);
      
      // Position in world space
      vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      // Position in view space
      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      vPositionNormal = normalize(mvPosition.xyz);
      vDepth = -mvPosition.z;
      
      gl_Position = projectionMatrix * mvPosition;
      vScreenPos = gl_Position;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uGlowColor;
    uniform float uOpacity;
    uniform float uFillOpacity;
    uniform float uScanLineSpeed;
    uniform float uScanLineDensity;
    uniform float uScanLineIntensity;
    uniform float uFresnelPower;
    uniform vec3 uMouseWorld;
    uniform vec3 uHoverColor;
    uniform float uHoverRadius;
    uniform float uHoverActive;
    uniform float uBurnOut;
    uniform vec3 uWipeDirection;
    uniform float uMinProj;
    uniform float uMaxProj;
    uniform float uClipY;
    uniform float uClipSide;
    uniform vec3 uHazeColor;
    uniform float uDepthLimit;
    uniform float uFadeZone;

    uniform float uShowFog;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uFogAmount;

    uniform float uGlitchActive;
    uniform float uGlitchSeed;
    uniform float uTransitionProgress;
    uniform float uSceneIndex;
    uniform float uActiveSceneIndex;

    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    varying vec3 vWorldPosition;
    varying float vDepth;
    varying vec4 vScreenPos;

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
      // Screen-space block glitch reveal logic
      vec2 screenUv = (vScreenPos.xy / vScreenPos.w) * 0.5 + 0.5;
      float tGrid = floor(uTime * 15.0);
      float bx = floor(screenUv.x * 16.0);
      float by = floor(screenUv.y * 16.0);
      float blockNoise = hash(vec2(bx, by) + tGrid * 0.5 + uGlitchSeed);

      // Transition threshold (increases from 0 to 1) combined with flash active state
      float glitchThreshold = uGlitchActive * 0.45;
      float threshold = max(uTransitionProgress, glitchThreshold);
      bool isGlitchedBlock = (blockNoise < threshold);

      // N-scene discard: active scene hides glitched blocks, incoming scene shows only glitched blocks
      bool isMyScene = (abs(uSceneIndex - uActiveSceneIndex) < 0.5);
      if (isMyScene) {
        if (isGlitchedBlock) discard;
      } else {
        if (!isGlitchedBlock) discard;
      }

      // 1. Vertical Wipe clipping with FBM-perturbed soft opacity transition
      float noiseVal = fbm(vWorldPosition.xz * 0.12 + vec2(uTime * 0.2));
      float perturbedY = vWorldPosition.y + (noiseVal - 0.5) * 12.0;
      
      float alphaWipe = 1.0;
      float feather = 12.0;
      if (uClipSide > 0.5) {
        alphaWipe = smoothstep(uClipY - feather, uClipY + feather, perturbedY);
      } else if (uClipSide < -0.5) {
        alphaWipe = 1.0 - smoothstep(uClipY - feather, uClipY + feather, perturbedY);
      }
      if (alphaWipe < 0.01) discard;

      // 2. Calculate side-sweeping wipe progress
      float proj = dot(vWorldPosition.xyz, uWipeDirection);
      float progress = clamp((proj - uMinProj) / (uMaxProj - uMinProj), 0.0, 1.0);
      
      // We want a smooth opacity transition zone of width 0.1
      float transitionWidth = 0.1;
      float wipeProgress = uBurnOut * 1.25 - 0.1;
      float alphaFactor = smoothstep(wipeProgress, wipeProgress + transitionWidth, progress);

      // 3. Compute normal hologram properties
      float fresnel = dot(vNormal, vPositionNormal);
      fresnel = clamp(1.0 - abs(fresnel), 0.0, 1.0);
      fresnel = pow(fresnel, uFresnelPower);

      // Subtle scanning line effect based on world Y position
      float scanY = vWorldPosition.y * uScanLineDensity - uTime * uScanLineSpeed;
      float scanline = sin(scanY) * 0.5 + 0.5;
      scanline = smoothstep(0.4, 0.6, scanline) * 0.2 * uScanLineIntensity;

      // Base translucent structure color
      float fillFactor = smoothstep(1.0, 2.0, uOpacity);
      float dynamicFillOpacity = mix(uFillOpacity, 1.0, fillFactor);
      vec3 baseHologramColor = uColor * dynamicFillOpacity; 
      
      // Interactive Hover Light Effect
      if (uHoverActive > 0.5) {
        float dist = distance(vWorldPosition, uMouseWorld);
        float hoverInfluence = 1.0 - smoothstep(0.0, uHoverRadius, dist);
        float boostedOpacity = mix(dynamicFillOpacity, 1.0, hoverInfluence * 0.8);
        vec3 hoveredColor = mix(uColor, uHoverColor, hoverInfluence);
        baseHologramColor = hoveredColor * boostedOpacity;
      }
      
      // Glow effect at transition boundary
      float transitionGlow = 0.0;
      if (uClipSide > 0.5 || uClipSide < -0.5) {
        float distToClip = abs(vWorldPosition.y - uClipY);
        if (distToClip < 1.5) {
          transitionGlow = 1.0 - (distToClip / 1.5);
        }
      }

      // Add glow and scanline to unburned side
      baseHologramColor += uGlowColor * fresnel;
      baseHologramColor += uGlowColor * scanline;
      baseHologramColor += uHoverColor * transitionGlow * 2.0;

      // Alpha: fill opacity forms the solid base, fresnel adds edge highlight on top
      float baseHologramAlpha = clamp(dynamicFillOpacity + fresnel * (1.0 - dynamicFillOpacity) * 1.5 + scanline + transitionGlow * 0.8, 0.0, 1.0) * min(uOpacity, 1.0);

      // Apply depth limit fading
      float fadeStart = max(0.0, uDepthLimit - uFadeZone);
      float depthAlpha = smoothstep(fadeStart, uDepthLimit, vDepth);

      // Apply the side-wipe, vertical wipe, and depth opacity factors
      float finalAlpha = baseHologramAlpha * alphaFactor * alphaWipe * depthAlpha;

      // Blend with thick white fog at the boundary to create cloud cover
      vec3 cloudColor = mix(uHazeColor, vec3(0.95, 0.95, 0.98), 0.4);
      baseHologramColor = mix(cloudColor, baseHologramColor, alphaWipe);

      // Apply environmental fog (depth-based fading)
      float fogFactor = clamp((uFogFar - vDepth) / max(uFogFar - uFogNear, 0.0001), 0.0, 1.0);
      float fogMix = uShowFog * uFogAmount * (1.0 - fogFactor);
      baseHologramColor = mix(baseHologramColor, uFogColor, fogMix);
      finalAlpha = mix(finalAlpha, 0.0, fogMix);

      if (finalAlpha < 0.01) discard;

      gl_FragColor = vec4(baseHologramColor, finalAlpha);
    }
  `
};
