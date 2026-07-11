import * as THREE from 'three';

export const SimonGlowShader = {
  uniforms: {
    uColor: { value: new THREE.Color("#ffffff") },
    uGlowIntensity: { value: 1.2 },
    uTime: { value: 0 },
  },
  vertexShader: `
    #include <skinning_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec4 vScreenPos;
    
    void main() {
      #include <skinbase_vertex>

      vec3 transformed = position;
      vec3 objectNormal = normal;

      #ifdef USE_SKINNING
        #include <skinning_vertex>
        #include <skinnormal_vertex>
      #endif

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      vNormal = normalize(normalMatrix * objectNormal);
      vViewPosition = -mvPosition.xyz;
      vScreenPos = gl_Position;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uGlowIntensity;
    uniform float uTime;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec4 vScreenPos;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Calculate a soft fresnel edge to boost outline glow
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
      
      // Compute soft tubelight white glow
      vec3 finalColor = uColor * uGlowIntensity * (1.0 + fresnel * 0.3);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};
