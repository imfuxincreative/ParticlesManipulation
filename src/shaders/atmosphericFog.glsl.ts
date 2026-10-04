export const atmosphereParsGLSL = /* glsl */ `
uniform vec3  uFogColor;
uniform float uFogDensity;
uniform float uFogHeightFalloff;
uniform float uFogHeightBase;
uniform float uFogEnabled;
uniform vec3  uCamPos;
uniform vec3  uGlowColor;
uniform vec3  uGlowDir;
uniform float uGlowStrength;
uniform vec3  uHorizonColor;
uniform vec3  uZenithColor;
uniform float uRimIntensity;
uniform float uRimWhiteMix;
uniform float uAmbientIntensity;

vec3 atmosphereInscatter(vec3 dir) {
  return uFogColor;
}

float atmosphereFactor(float viewDist, vec3 worldPos) {
  if (uFogEnabled < 0.5) return 0.0;

  // Preserve clear foreground (first 10u in front of camera stay clean)
  float effectiveDist = max(viewDist - 10.0, 0.0);
  if (effectiveDist <= 0.0) return 0.0;

  // Ground height falloff density
  float h = max(worldPos.y - uFogHeightBase, 0.0);
  float heightLayer = exp(-h * uFogHeightFalloff);

  // Fog distance ramp (fixed spatial range)
  float distRamp = 1.0 - exp(-effectiveDist * 0.012);

  // Fog Density scales opacity THICKNESS directly: higher density = thicker, heavier opacity blend
  float thicknessMultiplier = max(uFogDensity, 0.001) * 85.0;

  float fogFactor = distRamp * (1.0 + heightLayer * 2.2) * thicknessMultiplier;

  return clamp(fogFactor, 0.0, 0.98);
}

vec3 applyAtmosphere(vec3 color, float viewDist, vec3 worldPos) {
  float f    = atmosphereFactor(viewDist, worldPos);
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color  = mix(color, vec3(luma), f * 0.5);
  color *= mix(1.0, 0.55, f);
  return mix(color, atmosphereInscatter(normalize(worldPos - uCamPos)), f);
}

vec3 applyAtmosphereAdditive(vec3 color, float viewDist, vec3 worldPos) {
  return color * (1.0 - atmosphereFactor(viewDist, worldPos));
}
`;
