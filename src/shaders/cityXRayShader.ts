import * as THREE from 'three';

export const CityXRayShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x888888) },
    uGlowColor: { value: new THREE.Color(0xffffff) },
    uOpacity: { value: 1.0 },
    uFillOpacity: { value: 0.15 },
    uScanLineSpeed: { value: 1.5 },
    uScanLineDensity: { value: 10.0 },
    uScanLineIntensity: { value: 0.0 },
    uFresnelPower: { value: 2.5 },
    uMouseWorld: { value: new THREE.Vector3(0, 0, 0) },
    uHoverColor: { value: new THREE.Color(0xe91e63) },
    uHoverRadius: { value: 10.0 },
    uHoverActive: { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    varying vec3 vWorldPosition;

    void main() {
      // Normal in view space
      vNormal = normalize(normalMatrix * normal);
      
      // Position in world space
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      
      // View vector (from vertex to camera)
      vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uGlowColor;
    uniform float uOpacity;
    uniform float uFillOpacity;
    uniform float uScanLineSpeed;
    uniform float uScanLineDensity;
    uniform float uScanLineIntensity;
    uniform float uFresnelPower;
    uniform vec3 uMouseWorld;
    uniform vec3 uHoverColor;
    uniform float uHoverRadius;
    uniform float uHoverActive;

    varying vec3 vNormal;
    varying vec3 vPositionNormal;
    varying vec3 vWorldPosition;

    void main() {
      // Fresnel Effect: bright at grazing angles
      float fresnel = dot(vNormal, vPositionNormal);
      fresnel = clamp(1.0 - abs(fresnel), 0.0, 1.0);
      fresnel = pow(fresnel, uFresnelPower);

      // Subtle scanning line effect based on world Y position
      float scanY = vWorldPosition.y * uScanLineDensity - uTime * uScanLineSpeed;
      float scanline = sin(scanY) * 0.5 + 0.5;
      
      // Sharpen the scanline a bit
      scanline = smoothstep(0.4, 0.6, scanline) * 0.2 * uScanLineIntensity;

      // Base translucent structure color
      vec3 finalColor = uColor * uFillOpacity; 
      
      // Interactive Hover Light Effect
      if (uHoverActive > 0.5) {
        float dist = distance(vWorldPosition, uMouseWorld);
        float hoverInfluence = 1.0 - smoothstep(0.0, uHoverRadius, dist);
        
        // Increase base fill opacity where hovered, and mix color towards hoverColor
        float boostedOpacity = mix(uFillOpacity, 1.0, hoverInfluence * 0.8); // 0.8 max boost
        vec3 hoveredColor = mix(uColor, uHoverColor, hoverInfluence);
        
        finalColor = hoveredColor * boostedOpacity;
      }
      
      // Add glow at edges
      finalColor += uGlowColor * fresnel;
      
      // Add scanline glow
      finalColor += uGlowColor * scanline;

      // Alpha depends heavily on fresnel to create the x-ray transparent look
      float alpha = clamp(fresnel * 1.5 + scanline + uFillOpacity, 0.0, 1.0) * uOpacity;

      gl_FragColor = vec4(finalColor, alpha);
    }
  `
};
