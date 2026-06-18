import * as THREE from 'three';

export const SkyShader = {
  uniforms: {
    uHorizonColor: { value: new THREE.Color('#ff007f') }, // Glowing color
    uExposure: { value: 1.0 },                            // Brightness multiplier
    uBurnOut: { value: 0.0 },
    uWipeDirection: { value: new THREE.Vector3(1.0, 0.0, 1.0).normalize() },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    
    void main() {
      // Calculate world position
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      // Make it render infinitely far (independent of camera translation, handled in SkyDome component)
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uHorizonColor;
    uniform float uExposure;
    uniform float uBurnOut;
    uniform float uTime;
    uniform vec3 uWipeDirection;
    
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
      // Direction vector from camera to sky dome fragment
      vec3 viewDir = normalize(vWorldPosition - cameraPosition);
      
      // Vertical view direction (-1.0 at nadir, 0.0 at horizon, 1.0 at zenith)
      float y = viewDir.y;
      
      // Pure solid gradient from white (horizon and below) to pink (zenith)
      vec3 zenithColor = uHorizonColor;
      vec3 horizonColor = vec3(1.0); // Clean white
      
      vec3 baseColor = mix(horizonColor, zenithColor, clamp(y, 0.0, 1.0));
      vec3 baseSkyColor = baseColor * uExposure;
      
      gl_FragColor = vec4(baseSkyColor, 1.0);
    }
  `
};
