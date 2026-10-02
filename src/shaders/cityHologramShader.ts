// Anime / Holographic City Shader Module
// Cleaned up for Ghibli / Anime style scene redesign

export const CityHologramShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uPointSize;

    attribute vec3 aColor;

    varying vec3 vColor;
    varying vec3 vWorldPos;
    varying float vDepth;

    void main() {
      vec3 pos = position;
      vColor = aColor;
      vWorldPos = pos;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float cameraDist = -mvPosition.z;
      vDepth = cameraDist;

      float baseSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 14.0);
      gl_PointSize = baseSize;
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uHoloColorPrimary;
    uniform vec3 uHoloColorSecondary;

    varying vec3 vColor;
    varying vec3 vWorldPos;
    varying float vDepth;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * uOpacity;
      float heightNorm = clamp((vWorldPos.y + 2.0) / 12.0, 0.0, 1.0);
      vec3 color = mix(uHoloColorPrimary, uHoloColorSecondary, heightNorm);

      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};

