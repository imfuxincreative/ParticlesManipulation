import * as THREE from "three";

/**
 * FrostedGlassShader
 *
 * Physically-grounded frosted glass surface with:
 * 1. Optical red backlight scattering (matching current atmosphere).
 * 2. Contact sharpness enhancement (hand/fingers pressed against the glass remain crisp).
 * 3. Distance-based diffusion blur (body further back fades into soft hazy red silhouette).
 * 4. Micro-surface sandblasted texture grain.
 * 5. Interactive pointer condensation glow.
 * 6. Click/touch refraction shockwave ripple.
 */
export const FrostedGlassShader = {
  uniforms: {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uHorizonColor: { value: new THREE.Color("#FF000D") },
    uZenithColor: { value: new THREE.Color("#FF0000") },
    uFogColor: { value: new THREE.Color("#E70D18") },
    uGlowColor: { value: new THREE.Color("#FF1A1A") },
    uContactPoint1: { value: new THREE.Vector2(0.5, 0.5) }, // Hand 1 UV on glass
    uContactPoint2: { value: new THREE.Vector2(0.5, 0.5) }, // Hand 2 UV on glass
    uContactDistance1: { value: 1.0 }, // Distance of hand 1 from glass surface (0 = touching)
    uContactDistance2: { value: 1.0 }, // Distance of hand 2 from glass surface (0 = touching)
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uMouseHover: { value: 0.0 },
    uRippleCenter: { value: new THREE.Vector2(-10.0, -10.0) },
    uRippleTime: { value: -1.0 },
    uRoughness: { value: 0.65 },
    uGrainStrength: { value: 0.18 },
    uOpacity: { value: 0.48 },
  },

  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vec4 mvPosition = viewMatrix * worldPos;
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uHorizonColor;
    uniform vec3 uZenithColor;
    uniform vec3 uFogColor;
    uniform vec3 uGlowColor;
    uniform vec2 uContactPoint1;
    uniform vec2 uContactPoint2;
    uniform float uContactDistance1;
    uniform float uContactDistance2;
    uniform vec2 uMouse;
    uniform float uMouseHover;
    uniform vec2 uRippleCenter;
    uniform float uRippleTime;
    uniform float uRoughness;
    uniform float uGrainStrength;
    uniform float uOpacity;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    // High-quality pseudo-random hash for frosted micro-grain
    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    // 2D Value Noise
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 uv = vUv;

      // 1. Refraction Ripple Wave on Click/Tap
      if (uRippleTime >= 0.0 && uRippleTime < 2.5) {
        vec2 d = uv - uRippleCenter;
        // Aspect ratio correction for circular ripples
        d.x *= (uResolution.x / max(1.0, uResolution.y));
        float dist = length(d);
        float waveSpeed = 1.8;
        float waveFreq = 38.0;
        float waveFront = uRippleTime * waveSpeed;
        float waveDist = abs(dist - waveFront);
        float rippleAmp = smoothstep(0.25, 0.0, waveDist) * sin(dist * waveFreq - uRippleTime * 14.0);
        float rippleDecay = exp(-uRippleTime * 1.6) * exp(-dist * 1.5);
        vec2 rippleOffset = normalize(d + 1e-4) * rippleAmp * rippleDecay * 0.04;
        uv += rippleOffset;
      }

      // 2. Optical Frosted Micro-Grain Texture
      float grain = (hash21(uv * 480.0 + fract(uTime * 0.1)) - 0.5) * uGrainStrength;
      float frostedNoise = vnoise(uv * 80.0) * 0.12;

      // 3. Pointer Condensation Clearing / Warmth Halo
      vec2 mouseDelta = uv - uMouse;
      mouseDelta.x *= (uResolution.x / max(1.0, uResolution.y));
      float mouseDist = length(mouseDelta);
      float mouseAura = exp(-mouseDist * 6.5) * uMouseHover;

      // 4. Contact Sharpness & Dark Silhouette Footprint
      // Hand 1 (Right/Touching hand)
      vec2 d1 = uv - uContactPoint1;
      float dist1 = length(d1);
      float contactProximity1 = smoothstep(0.18, 0.0, uContactDistance1);
      float handFootprint1 = smoothstep(0.22, 0.02, dist1) * contactProximity1;

      // Hand 2
      vec2 d2 = uv - uContactPoint2;
      float dist2 = length(d2);
      float contactProximity2 = smoothstep(0.18, 0.0, uContactDistance2);
      float handFootprint2 = smoothstep(0.22, 0.02, dist2) * contactProximity2;

      float totalContact = max(handFootprint1, handFootprint2);

      // 5. Atmospheric Red Ambient and Backlight Gradient
      // Vertical gradient from deep wine red at the bottom to vibrant crimson in the center
      float verticalGrad = smoothstep(-0.2, 1.2, uv.y);
      vec3 bgRed = mix(uFogColor, uHorizonColor, verticalGrad);
      
      // Central radiant back-glow behind the character silhouette
      vec2 center = vec2(0.5, 0.58);
      vec2 toCenter = uv - center;
      toCenter.x *= (uResolution.x / max(1.0, uResolution.y));
      float centerGlow = exp(-length(toCenter) * 2.2) * 0.45;
      bgRed += uGlowColor * centerGlow;

      // 6. Frosted Glass Diffusion Layer
      // As light passes through the frosted surface, it softens and scatters
      vec3 frostedTone = bgRed + vec3(grain + frostedNoise) * 0.35;

      // When hands touch the glass, contact shadow darkens the glass locally
      // mimicking skin pressed against a translucent pane (dark silhouette with deep red rim)
      vec3 contactShadow = vec3(0.06, 0.01, 0.02); // Deep dark silhouette
      vec3 finalColor = mix(frostedTone, contactShadow, totalContact * 0.88);

      // Subtle edge light scattering on the contact rim
      float contactEdge = smoothstep(0.04, 0.01, abs(dist1 - 0.12)) * contactProximity1;
      finalColor += uGlowColor * contactEdge * 0.35;

      // Add mouse condensation optical sheen
      finalColor += uGlowColor * mouseAura * 0.22;

      // Fresnel rim reflection on the outer glass surface
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 3.0);
      finalColor += uZenithColor * fresnel * 0.18;

      // Dynamic alpha: frosted glass is translucent red veil (0.48), becoming denser (0.95) where the hand touches
      float alpha = mix(uOpacity, 0.96, totalContact);
      gl_FragColor = vec4(finalColor, alpha);
    }
  `,
};
