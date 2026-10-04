import { atmosphereParsGLSL } from "./atmosphericFog.glsl";
import { noiseGLSL } from "./noise.glsl";

export const hedgePillarVertexShader = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vLocalPos;
varying vec2 vUv;

uniform float uTwistAmount;
uniform float uHeight;

void main() {
  vUv = uv;
  vLocalPos = position;

  // Apply twist and hourglass waist deformation based on height
  vec3 pos = position;
  float hNorm = clamp((pos.y + uHeight * 0.5) / uHeight, 0.0, 1.0);
  
  // Hourglass waist
  float waist = 1.0 - 0.15 * sin(hNorm * 3.14159);
  pos.xz *= waist;

  // Gentle twist
  float angle = (hNorm - 0.5) * uTwistAmount;
  float cosA = cos(angle);
  float sinA = sin(angle);
  mat2 rot = mat2(cosA, -sinA, sinA, cosA);
  pos.xz = rot * pos.xz;

  vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPosition.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const hedgePillarFragmentShader = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vLocalPos;
varying vec2 vUv;

uniform float uHeight;
uniform float uIsHero; // 1.0 for hero, 0.0 for depth pillars

${atmosphereParsGLSL}
${noiseGLSL}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);

  // Hedge/leaf surface bump & micro-AO texture using fBm
  vec3 scalePos = vWorldPos * 0.8;
  float noiseTex = fbm2D(scalePos.xz + scalePos.y * 0.5, 4);
  float leafAO = clamp(0.65 + 0.35 * noiseTex, 0.0, 1.0);

  // Base material: dark foliage/stone
  vec3 baseColor = vec3(0.08, 0.09, 0.08) * leafAO;

  // Rim light direction from uGlowDir
  vec3 L_rim = normalize(uGlowDir + vec3(0.0, 0.4, 0.0));
  float NdotL_rim = max(dot(N, L_rim), 0.0);
  
  // Half-lambert lighting
  float halfLambert = NdotL_rim * 0.5 + 0.5;

  // Top lighting (hot white rim at top of hero pillar)
  float topGradient = smoothstep(uHeight * 0.3, uHeight * 0.5 - 0.5, vLocalPos.y);
  float topHighlight = pow(topGradient, 2.5) * max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);
  
  vec3 rimColor = mix(uGlowColor, vec3(1.0), uRimWhiteMix);
  vec3 lighting = baseColor * uAmbientIntensity * 2.0;
  
  // Apply rim light
  lighting += rimColor * (pow(NdotL_rim, 2.0) * uRimIntensity * 0.5) * leafAO;

  // Apply top hot edge (passing bloom threshold)
  if (uIsHero > 0.5) {
    lighting += vec3(1.8, 1.8, 1.7) * topHighlight * 4.5 * leafAO;
  }

  // Distance fog & atmosphere inscattering
  float dist = distance(vWorldPos, uCamPos);
  vec3 finalColor = applyAtmosphere(lighting, dist, vWorldPos);

  gl_FragColor = vec4(finalColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
