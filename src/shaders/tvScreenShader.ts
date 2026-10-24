import * as THREE from 'three';
import { atmosphereParsGLSL } from './atmosphericFog.glsl';

export const TvScreenShader = {
  uniforms: {
    uMap: { value: null as THREE.Texture | null },
    uHasMap: { value: 0.0 },
    uColor: { value: new THREE.Color("#ffffff") },
    uCoreColor: { value: new THREE.Color("#ffffff") },
    uIntensity: { value: 3.5 },
    uScanlines: { value: 0.25 },
    uScanlineDensity: { value: 350.0 },
    uSubpixel: { value: 0.2 },
    uSubpixelDensity: { value: 450.0 },
    uVignette: { value: 0.4 },
    uFlicker: { value: 0.1 },
    uNoise: { value: 0.05 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vec3 transformed = position;
      vec3 objectNormal = normal;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      vNormal = normalize(normalMatrix * objectNormal);
      vViewPosition = -mvPosition.xyz;

      vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPos4.xyz;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap;
    uniform float uHasMap;
    uniform vec3 uColor;
    uniform vec3 uCoreColor;
    uniform float uIntensity;
    uniform float uScanlines;
    uniform float uScanlineDensity;
    uniform float uSubpixel;
    uniform float uSubpixelDensity;
    uniform float uVignette;
    uniform float uFlicker;
    uniform float uNoise;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    ${atmosphereParsGLSL}

    // High frequency pseudo-random hash for phosphor/static noise
    float hash21(vec2 p) {
      p = fract(p * vec2(233.34, 851.73));
      p += dot(p, p + 23.45);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float NdotV = max(dot(normal, viewDir), 0.0);

      // Sample original EMISSION material texture map if available
      vec4 texel = vec4(1.0);
      if (uHasMap > 0.5) {
        texel = texture2D(uMap, vUv);
      }

      // Base screen color: preserves original TV broadcast image, multiplied by tint color
      vec3 screenBase = texel.rgb * uColor;

      // 1. Horizontal raster scanlines overlay
      float scanline = sin(vUv.y * uScanlineDensity + uTime * 2.0) * 0.5 + 0.5;
      scanline = mix(1.0, 0.78 + 0.22 * scanline, clamp(uScanlines, 0.0, 1.0));

      // 2. RGB Subpixel phosphor stripes (Red, Green, Blue columns)
      float subpixelPos = fract(vUv.x * uSubpixelDensity);
      vec3 rgbStripe = vec3(
        smoothstep(0.0, 0.25, subpixelPos) * (1.0 - smoothstep(0.30, 0.40, subpixelPos)),
        smoothstep(0.33, 0.58, subpixelPos) * (1.0 - smoothstep(0.63, 0.73, subpixelPos)),
        smoothstep(0.66, 0.91, subpixelPos)
      );
      vec3 phosphorColor = mix(vec3(1.0), rgbStripe * 2.2, clamp(uSubpixel, 0.0, 1.0));

      // 3. Subtle Screen Edge Vignetting
      vec2 centeredUv = abs(vUv - 0.5) * 2.0;
      float vignetteDist = dot(centeredUv, centeredUv) * 0.5;
      float vignette = 1.0 - smoothstep(0.5, 1.2, vignetteDist);
      vignette = mix(1.0, vignette, clamp(uVignette, 0.0, 1.0));

      // 4. Subtle hardware refresh micro-flicker & static noise
      float flicker = 1.0;
      if (uFlicker > 0.001) {
        float f1 = sin(uTime * 58.0) * 0.035;
        float f2 = sin(uTime * 123.0) * 0.02;
        float f3 = sin(uTime * 7.5) * 0.03;
        flicker += (f1 + f2 + f3) * uFlicker;
      }

      float staticNoise = hash21(vUv * 350.0 + fract(uTime * 4.0));
      float noiseFactor = mix(1.0, 0.92 + 0.16 * staticNoise, clamp(uNoise, 0.0, 1.0));

      // 5. LED TV Glass Gleam / Fresnel highlight
      float fresnel = pow(1.0 - NdotV, 3.0);
      vec3 glassReflection = vec3(1.0) * fresnel * 0.35;

      // 6. Base Screen Radiant Emission calculation
      vec3 screenPattern = phosphorColor * scanline * noiseFactor;
      vec3 radiantEmission = screenBase * screenPattern * (uIntensity * flicker * vignette);

      // Hot core boost for bright parts of the TV image
      float luma = dot(screenBase, vec3(0.299, 0.587, 0.114));
      float coreFactor = pow(NdotV, 2.0) * clamp(luma, 0.0, 1.0) * 0.25;
      vec3 finalScreenColor = mix(radiantEmission, radiantEmission * 1.35 + uCoreColor * 0.15, coreFactor);
      finalScreenColor += glassReflection * (uIntensity * 0.1);

      // 7. Atmospheric Fog & Environmental Lighting Integration
      float dist = distance(vWorldPos, uCamPos);
      vec3 foggedColor = applyAtmosphere(finalScreenColor, dist, vWorldPos);

      gl_FragColor = vec4(foggedColor, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};
