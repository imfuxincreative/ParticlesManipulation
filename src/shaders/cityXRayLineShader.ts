import * as THREE from 'three';

export const CityXRayLineShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0xe91e63) },
    uOpacity: { value: 0.5 },
    uGlowIntensity: { value: 2.5 },
    uDepthLimit: { value: 40.0 },    // Animated reveal radius (lerped in useFrame)
    uFadeZone: { value: 15.0 },      // Width of the fade-out band at the edge
    uTime: { value: 0 },
    uBurnOut: { value: 0.0 },
    uWipeDirection: { value: new THREE.Vector3(1.0, 0.0, 1.0).normalize() },
    uMinProj: { value: -100.0 },
    uMaxProj: { value: 100.0 },
    uClipY: { value: 0.0 },
    uClipSide: { value: 0.0 },
    uGlitchActive: { value: 0.0 },
    uGlitchSeed: { value: 0.0 },
    uTransitionProgress: { value: 0.0 },
    uSceneIndex: { value: 0.0 },
    uActiveSceneIndex: { value: 0.0 },
  },
  vertexShader: `
    #include <skinning_pars_vertex>

    uniform float uTime;
    varying float vDepth;
    varying vec3 vWorldPosition;
    varying vec4 vScreenPos;
    
    void main() {
      #include <skinbase_vertex>

      vec3 transformed = position;

      #ifdef USE_SKINNING
        #include <skinning_vertex>
      #endif

      // World position for the fragment shader wipe calculations
      vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      vDepth = -mvPosition.z; // Distance from camera in view space
      gl_Position = projectionMatrix * mvPosition;
      vScreenPos = gl_Position;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uGlowIntensity;
    uniform float uDepthLimit;
    uniform float uFadeZone;
    uniform float uBurnOut;
    uniform float uTime;
    uniform vec3 uWipeDirection;
    uniform float uMinProj;
    uniform float uMaxProj;
    uniform float uClipY;
    uniform float uClipSide;

    uniform float uGlitchActive;
    uniform float uGlitchSeed;
    uniform float uTransitionProgress;
    uniform float uSceneIndex;
    uniform float uActiveSceneIndex;
    
    varying float vDepth;
    varying vec3 vWorldPosition;
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

      // 0. Vertical Wipe clipping with FBM-perturbed soft opacity transition
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

      // 1. Lines at depth < (uDepthLimit - uFadeZone) are fully visible
      // Lines at depth > uDepthLimit are fully hidden
      float fadeStart = max(0.0, uDepthLimit - uFadeZone);
      float alpha = uOpacity * (1.0 - smoothstep(fadeStart, uDepthLimit, vDepth));
      
      // 2. Calculate sweep/wipe transition progress
      float proj = dot(vWorldPosition.xyz, uWipeDirection);
      float progress = clamp((proj - uMinProj) / (uMaxProj - uMinProj), 0.0, 1.0);
      
      // Lines trail behind hologram by 0.15 progress units
      float transitionWidth = 0.1;
      float wipeProgress = uBurnOut * 1.25 - 0.25;
      float alphaFactor = smoothstep(wipeProgress, wipeProgress + transitionWidth, progress);
      
      float finalAlpha = alpha * alphaFactor * alphaWipe;
      
      if (finalAlpha < 0.01) discard;
      
      vec3 finalColor = uColor * uGlowIntensity;
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
};
