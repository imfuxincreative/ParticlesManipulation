import * as THREE from 'three';

export const CityXRayLineShader = {
  uniforms: {
    uColor: { value: new THREE.Color(0xe91e63) },
    uOpacity: { value: 0.5 },
    uDepthLimit: { value: 40.0 },    // Animated reveal radius (lerped in useFrame)
    uFadeZone: { value: 15.0 },      // Width of the fade-out band at the edge
  },
  vertexShader: `
    varying float vDepth;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vDepth = -mvPosition.z; // Distance from camera in view space
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uDepthLimit;
    uniform float uFadeZone;
    varying float vDepth;
    void main() {
      // Lines at depth < (uDepthLimit - uFadeZone) are fully visible
      // Lines at depth > uDepthLimit are fully hidden
      // In between they smoothly fade out
      float fadeStart = max(0.0, uDepthLimit - uFadeZone);
      float alpha = uOpacity * (1.0 - smoothstep(fadeStart, uDepthLimit, vDepth));
      
      if (alpha < 0.01) discard;
      
      gl_FragColor = vec4(uColor, alpha);
    }
  `
};
