// Anime Particle City Shader Module
// Cleaned up for Ghibli / Anime style scene redesign

export const CityParticleShader = {
  vertexShader: `
    uniform float uTime;
    uniform float uPointSize;

    attribute vec3 aColor;

    varying vec3 vColor;
    varying float vDepth;

    void main() {
      vec3 pos = position;
      vColor = aColor;
      vDepth = clamp((pos.y + 5.0) / 10.0, 0.0, 1.0);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float cameraDist = -mvPosition.z;
      float baseSize = clamp(uPointSize * (20.0 / max(cameraDist, 1.0)), 1.0, 12.0);
      gl_PointSize = baseSize;
    }
  `,
  fragmentShader: `
    uniform vec3 uHazeColor;
    uniform float uHazeDensity;
    uniform vec3 uTint;
    uniform float uTintMix;
    uniform float uOpacity;

    varying vec3 vColor;
    varying float vDepth;

    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;

      float alpha = (1.0 - smoothstep(0.3, 0.5, dist)) * uOpacity;
      vec3 color = mix(vColor, uTint, uTintMix);
      color = mix(color, uHazeColor, vDepth * uHazeDensity);

      if (alpha < 0.01) discard;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};

