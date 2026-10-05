import { Effect } from "postprocessing";
import * as THREE from "three";

const fragmentShader = /* glsl */ `
uniform vec3 uVignetteColor;
uniform float uVignetteStrength;
uniform float uVignetteOffset;
uniform float uGrainAmount;
uniform float uBuildingContrast;
uniform float uTime;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec4 color = inputColor;

  // Apply Building & Light Contrast Grading
  color.rgb = max((color.rgb - vec3(0.5)) * uBuildingContrast + vec3(0.5), vec3(0.0));

  // Bottom-biased Vignette (mixes toward zenith color instead of black)
  vec2 dist = (uv - vec2(0.5, 0.42));
  float d = length(dist);
  float vignette = smoothstep(uVignetteOffset, uVignetteOffset + uVignetteStrength, d);
  color.rgb = mix(color.rgb, uVignetteColor, vignette * 0.75);

  // Luminance-weighted film grain
  float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  float noise = rand(uv + vec2(uTime * 0.05, uTime * 0.03)) - 0.5;
  float grainWeight = clamp(1.0 - abs(luma - 0.5) * 2.0, 0.2, 1.0);
  color.rgb += noise * uGrainAmount * grainWeight * 0.25;

  outputColor = color;
}
`;

export class CrimsonGradeEffect extends Effect {
  constructor({
    vignetteColor = new THREE.Color("#3a0004").convertSRGBToLinear(),
    vignetteStrength = 0.75,
    vignetteOffset = 0.25,
    grainAmount = 0.12,
    buildingContrast = 1.0,
  }: {
    vignetteColor?: THREE.Color;
    vignetteStrength?: number;
    vignetteOffset?: number;
    grainAmount?: number;
    buildingContrast?: number;
  } = {}) {
    super("CrimsonGradeEffect", fragmentShader, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uVignetteColor", new THREE.Uniform(vignetteColor)],
        ["uVignetteStrength", new THREE.Uniform(vignetteStrength)],
        ["uVignetteOffset", new THREE.Uniform(vignetteOffset)],
        ["uGrainAmount", new THREE.Uniform(grainAmount)],
        ["uBuildingContrast", new THREE.Uniform(buildingContrast)],
        ["uTime", new THREE.Uniform(0)],
      ]),
    });
  }

  update(_renderer: THREE.WebGLRenderer, _inputBuffer: THREE.WebGLRenderTarget, deltaTime: number) {
    const timeUniform = this.uniforms.get("uTime");
    if (timeUniform) {
      timeUniform.value += deltaTime;
    }
  }
}
