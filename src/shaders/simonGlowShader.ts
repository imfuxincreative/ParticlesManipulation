import * as THREE from 'three';

export const SimonGlowShader = {
  uniforms: {
    uColor: { value: new THREE.Color("#ffffff") },
    uGlowIntensity: { value: 1.2 },
    uTime: { value: 0 },
    uOpacity: { value: 0.4 },
    uShowFog: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0x0b0c10) },
    uFogNear: { value: 15.0 },
    uFogFar: { value: 80.0 },
    uFogAmount: { value: 1.0 },
    uLocalMin: { value: new THREE.Vector3(-1, -1, -1) },
    uLocalMax: { value: new THREE.Vector3(1, 1, 1) },
    uIsHair: { value: 0.0 },
  },
  vertexShader: `
    #include <skinning_pars_vertex>

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec4 vScreenPos;
    varying float vDepth;
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
      vScreenPos = gl_Position;
      vDepth = -mvPosition.z;

      // Compute normalized local position relative to bounding box
      vNormalizedPos = (position - uLocalMin) / max(uLocalMax - uLocalMin, vec3(0.0001));
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uGlowIntensity;
    uniform float uTime;
    uniform float uOpacity;
    uniform float uIsHair;
    
    uniform float uShowFog;
    uniform vec3 uFogColor;
    uniform float uFogNear;
    uniform float uFogFar;
    uniform float uFogAmount;
    
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec4 vScreenPos;
    varying float vDepth;
    varying vec3 vNormalizedPos;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      
      // Calculate a soft fresnel edge to boost outline glow
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
      
      // Compute soft tubelight white glow
      vec3 finalColor = uColor * uGlowIntensity * (1.0 + fresnel * 0.3);
      
      // Calculate closeness to the local extremities of the clothing mesh (X, Y, and Z to support all orientations)
      float edgeX = min(vNormalizedPos.x, 1.0 - vNormalizedPos.x);
      float edgeY = min(vNormalizedPos.y, 1.0 - vNormalizedPos.y);
      float edgeZ = min(vNormalizedPos.z, 1.0 - vNormalizedPos.z);

      // borderFactor is 1.0 at outer sleeve/hem borders and 0.0 in the middle
      float borderFactorX = smoothstep(0.18, 0.0, edgeX);
      float borderFactorY = smoothstep(0.18, 0.0, edgeY);
      float borderFactorZ = smoothstep(0.18, 0.0, edgeZ);
      float borderFactor = max(max(borderFactorX, borderFactorY), borderFactorZ);

      // Blend base opacity smoothly to 1.0 (fully opaque) near clothing extremities, or force 1.0 for hair
      float baseOpacity = mix(mix(uOpacity, 1.0, borderFactor), 1.0, uIsHair);

      // Apply environmental fog (depth-based fading for Simon glowing clothes)
      float fogFactor = clamp((uFogFar - vDepth) / max(uFogFar - uFogNear, 0.0001), 0.0, 1.0);
      float fogMix = uShowFog * uFogAmount * (1.0 - fogFactor);
      vec3 glowColor = mix(finalColor, uFogColor, fogMix);
      float alpha = mix(baseOpacity, 0.0, fogMix);
      
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(glowColor, alpha);
    }
  `
};
