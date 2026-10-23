import * as THREE from 'three';
import { atmosphereParsGLSL } from './atmosphericFog.glsl';

export const FlyingCarLedShader = {
  uniforms: {
    uColor: { value: new THREE.Color("#00f0ff") },
    uIntensity: { value: 3.5 },
    uCoreColor: { value: new THREE.Color("#ffffff") },
    uCoreMix: { value: 0.35 },
    uPulse: { value: 1.0 },
    uPulseSpeed: { value: 2.5 },
    uPulseAmount: { value: 0.2 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    void main() {
      vec3 transformed = position;
      vec3 objectNormal = normal;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      vNormal = normalize(normalMatrix * objectNormal);
      vViewPosition = -mvPosition.xyz;

      vec4 worldPos4 = modelMatrix * vec4(transformed, 1.0);
      vWorldPos = worldPos4.xyz;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform vec3 uCoreColor;
    uniform float uCoreMix;
    uniform float uPulse;
    uniform float uPulseSpeed;
    uniform float uPulseAmount;
    uniform float uTime;

    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPos;

    ${atmosphereParsGLSL}

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Fresnel angle falloff - enhances light lens glancing angles
      float NdotV = max(dot(normal, viewDir), 0.0);
      float fresnel = pow(1.0 - NdotV, 2.5);

      // Organic micro-pulse / electrical shimmer
      float pulseFactor = 1.0;
      if (uPulse > 0.5) {
        pulseFactor += sin(uTime * uPulseSpeed) * (uPulseAmount * 0.7);
        pulseFactor += sin(uTime * 17.3) * (uPulseAmount * 0.15);
      }

      // Base radiant light color scaled by intensity and pulse
      vec3 radiantColor = uColor * (uIntensity * pulseFactor);

      // Hot inner core: at direct viewing angles and high intensity, blend towards hot core color
      float coreFactor = pow(NdotV, 1.5) * uCoreMix;
      vec3 hotColor = mix(radiantColor, uCoreColor * (uIntensity * pulseFactor * 1.3), clamp(coreFactor, 0.0, 1.0));

      // Boost glancing rim for translucent LED light housing
      vec3 finalColor = hotColor + radiantColor * (fresnel * 0.45);

      // Fog & Atmosphere integration
      float dist = distance(vWorldPos, uCamPos);
      vec3 foggedColor = applyAtmosphere(finalColor, dist, vWorldPos);

      gl_FragColor = vec4(foggedColor, 1.0);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};
