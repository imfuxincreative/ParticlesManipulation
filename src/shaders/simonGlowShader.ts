import * as THREE from 'three';
import { atmosphereParsGLSL } from './atmosphericFog.glsl';

export const SimonGlowShader = {
  uniforms: {
    uColor: { value: new THREE.Color("#ffffff") },
    uGlowIntensity: { value: 1.2 },
    uTime: { value: 0 },
    uOpacity: { value: 0.4 },
    uLocalMin: { value: new THREE.Vector3(-1, -1, -1) },
    uLocalMax: { value: new THREE.Vector3(1, 1, 1) },
    uIsHair: { value: 0.0 },
  },
  vertexShader: `
    #include <skinning_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;
    varying vec3 vNormalizedPos;

    uniform vec3 uLocalMin;
    uniform vec3 uLocalMax;
    
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
      
      vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPos4.xyz;

      vNormalizedPos = (position - uLocalMin) / max(uLocalMax - uLocalMin, vec3(0.0001));
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uGlowIntensity;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uIsHair;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;
    varying vec3 vNormalizedPos;
    
    ${atmosphereParsGLSL}

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
      vec3 finalColor = uColor * uGlowIntensity * (1.0 + fresnel * 0.3);
      
      float edgeX = min(vNormalizedPos.x, 1.0 - vNormalizedPos.x);
      float edgeY = min(vNormalizedPos.y, 1.0 - vNormalizedPos.y);
      float edgeZ = min(vNormalizedPos.z, 1.0 - vNormalizedPos.z);

      float borderFactorX = smoothstep(0.18, 0.0, edgeX);
      float borderFactorY = smoothstep(0.18, 0.0, edgeY);
      float borderFactorZ = smoothstep(0.18, 0.0, edgeZ);
      float borderFactor = max(max(borderFactorX, borderFactorY), borderFactorZ);

      float baseOpacity = mix(mix(uOpacity, 1.0, borderFactor), 1.0, uIsHair);

      float dist = distance(vWorldPos, uCamPos);
      vec3 foggedColor = applyAtmosphere(finalColor, dist, vWorldPos);

      gl_FragColor = vec4(foggedColor, baseOpacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};
