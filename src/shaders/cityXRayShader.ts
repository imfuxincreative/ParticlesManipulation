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
  },
  vertexShader: `
    #include <skinning_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    varying vec3 vWorldPosition;
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
      
      // View vector (from vertex to camera)
      vPositionNormal = normalize((modelViewMatrix * vec4(transformed, 1.0)).xyz);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
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

    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    varying vec3 vWorldPosition;

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
      // 1. Calculate side-sweeping wipe progress
      float proj = dot(vWorldPosition.xyz, uWipeDirection);
      float progress = clamp((proj - uMinProj) / (uMaxProj - uMinProj), 0.0, 1.0);
      
      // We want a smooth opacity transition zone of width 0.1
      float transitionWidth = 0.1;
      float wipeProgress = uBurnOut * 1.25 - 0.1;
      float alphaFactor = smoothstep(wipeProgress, wipeProgress + transitionWidth, progress);

      // 2. Compute normal hologram properties
      float fresnel = dot(vNormal, vPositionNormal);
      fresnel = clamp(1.0 - abs(fresnel), 0.0, 1.0);
      fresnel = pow(fresnel, uFresnelPower);

      // Subtle scanning line effect based on world Y position
      float scanY = vWorldPosition.y * uScanLineDensity - uTime * uScanLineSpeed;
      float scanline = sin(scanY) * 0.5 + 0.5;
      scanline = smoothstep(0.4, 0.6, scanline) * 0.2 * uScanLineIntensity;

      // Base translucent structure color
      vec3 baseHologramColor = uColor * uFillOpacity; 
      
      // Interactive Hover Light Effect
      if (uHoverActive > 0.5) {
        float dist = distance(vWorldPosition, uMouseWorld);
        float hoverInfluence = 1.0 - smoothstep(0.0, uHoverRadius, dist);
        float boostedOpacity = mix(uFillOpacity, 1.0, hoverInfluence * 0.8);
        vec3 hoveredColor = mix(uColor, uHoverColor, hoverInfluence);
        baseHologramColor = hoveredColor * boostedOpacity;
      }
      
      // Add glow and scanline to unburned side
      baseHologramColor += uGlowColor * fresnel;
      baseHologramColor += uGlowColor * scanline;

      // Alpha depends heavily on fresnel to create the x-ray transparent look
      float baseHologramAlpha = clamp(fresnel * 1.5 + scanline + uFillOpacity, 0.0, 1.0) * uOpacity;

      // Apply the side-wipe opacity factor
      float finalAlpha = baseHologramAlpha * alphaFactor;

      if (finalAlpha < 0.01) discard;

      gl_FragColor = vec4(baseHologramColor, finalAlpha);
    }
  `
};
