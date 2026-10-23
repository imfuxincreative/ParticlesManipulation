import { atmosphereParsGLSL } from "./atmosphericFog.glsl";
import { noiseGLSL } from "./noise.glsl";

export const skyDomeVertexShader = /* glsl */ `
varying vec3 vWorldDir;

void main() {
  vWorldDir = mat3(modelMatrix) * position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_Position.z = gl_Position.w;
}
`;

export const skyDomeFragmentShader = /* glsl */ `
varying vec3 vWorldDir;

uniform float uSkyExposure;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform float uCloudContrast;
uniform float uCloudCoverage;
uniform float uTime;

${atmosphereParsGLSL}
${noiseGLSL}

#ifndef CLOUD_OCTAVES
  #define CLOUD_OCTAVES 5
#endif

void main() {
  vec3 dir = normalize(vWorldDir);

  // Vertical sky gradient factor (-0.35 below horizon to 0.65 up in zenith) - EXACT ORIGINAL
  float t = smoothstep(-0.35, 0.65, dir.y);

  // Sky background gradient from Horizon Color to Zenith Color - EXACT ORIGINAL
  vec3 skyBase = mix(uHorizonColor, uZenithColor, pow(t, 0.75)) * max(uSkyExposure, 0.1);

  // Cloud projection mapping - EXACT ORIGINAL
  float cloudY = max(dir.y + 0.35, 0.08);
  vec2 p1 = dir.xz / cloudY * uCloudScale + uTime * uCloudSpeed * vec2(1.0, 0.35);
  vec2 p2 = dir.xz / cloudY * (uCloudScale * 2.2) - uTime * uCloudSpeed * vec2(0.4, 0.75);

  // fbm2D output is [-0.5, 0.5], remap to [0, 1] - EXACT ORIGINAL
  float n1 = fbm2D(p1, CLOUD_OCTAVES) * 0.5 + 0.5;
  float n2 = fbm2D(p2, 3) * 0.5 + 0.5;
  float cloudVal = mix(n1, n2, 0.38);
  float pattern = (cloudVal - 0.5) * uCloudContrast + 0.5;

  // Cloud coverage threshold - EXACT ORIGINAL
  float threshold = mix(0.95, 0.15, clamp(uCloudCoverage, 0.0, 1.0));
  float cloudShape = smoothstep(threshold, threshold + 0.25, pattern);

  // Cloud shading: responds dynamically to Zenith Color, Horizon Color, and Glow Color - EXACT ORIGINAL
  vec3 cloudShadow = mix(uZenithColor * 0.3, uHorizonColor * 0.5, pow(t, 0.5));
  vec3 cloudHighlight = mix(uHorizonColor * 1.35, uGlowColor * 1.5, pow(t, 0.4));
  vec3 cloudToned = mix(cloudShadow, cloudHighlight, cloudShape);

  // Cloud density mask fading near horizon (extended downward so clouds remain visible when tilting camera)
  float cloudMask = smoothstep(-0.25, 0.25, dir.y) * cloudShape;

  // Combine sky background and clouds - EXACT ORIGINAL
  vec3 skyCombined = mix(skyBase, cloudToned, cloudMask * 0.9);

  // Seamless horizon blend to uFogColor (extended downward so ground fog doesn't erase sky at lower angles)
  float fogSeam = smoothstep(-0.55, -0.15, dir.y);
  vec3 col = mix(uFogColor, skyCombined, fogSeam);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
