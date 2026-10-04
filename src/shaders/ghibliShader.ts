import * as THREE from 'three';
import { atmosphereParsGLSL } from './atmosphericFog.glsl';

export function colorsToFloat32Array(colors: (string | THREE.Color)[]): Float32Array {
  const arr = new Float32Array(12);
  const temp = new THREE.Color();
  for (let i = 0; i < 4; i++) {
    const c = colors[i] || '#000000';
    if (c instanceof THREE.Color) {
      temp.copy(c);
    } else {
      temp.set(c);
    }
    arr[i * 3 + 0] = temp.r;
    arr[i * 3 + 1] = temp.g;
    arr[i * 3 + 2] = temp.b;
  }
  return arr;
}

export function thresholdsToFloat32Array(thresholds: number[]): Float32Array {
  const arr = new Float32Array(3);
  for (let i = 0; i < 3; i++) {
    arr[i] = thresholds[i] ?? 0.0;
  }
  return arr;
}

export interface GhibliShaderUniforms {
  colorMap: { value: Float32Array };
  brightnessThresholds: { value: Float32Array };
  lightPosition: { value: THREE.Vector3 };
  uTime: { value: number };
  uWindSpeed: { value: number };
  uWindStrength: { value: number };
  uWindScale: { value: number };
  uGrassSway: { value: number };
  uGrowthProgress: { value: number };
  uSubsurfaceStrength: { value: number };
  uGrassRevealProgress: { value: number };
  uGrassRevealDistance: { value: number };
  uGrassRevealSoftness: { value: number };
  uGrassRevealOffset: { value: number };
  uGrassRevealDirection: { value: THREE.Vector3 };
  uCameraPosition: { value: THREE.Vector3 };
  uGrassHeight: { value: number };
  uGrassWidth: { value: number };
  uRealisticMode: { value: number };
  [key: string]: { value: unknown };
}

export const GhibliShader = {
  uniforms: {
    colorMap: {
      value: colorsToFloat32Array(['#ff4d4d', '#b3000a', '#660006', '#260002']),
    },
    brightnessThresholds: {
      value: thresholdsToFloat32Array([0.65, 0.35, 0.05]),
    },
    lightPosition: { value: new THREE.Vector3(15, 20, 15) },
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.2 },
    uWindStrength: { value: 0.3 },
    uWindScale: { value: 0.15 },
    uGrassSway: { value: 1.0 },
    uGrowthProgress: { value: 1.0 },
    uSubsurfaceStrength: { value: 0.25 },
    uGrassRevealProgress: { value: 0.0 },
    uGrassRevealDistance: { value: 710.0 },
    uGrassRevealSoftness: { value: 100.0 },
    uGrassRevealOffset: { value: 0.0 },
    uGrassRevealDirection: { value: new THREE.Vector3(0.0, 0.0, -1.0) },
    uCameraPosition: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
    uGrassHeight: { value: 1.7 },
    uGrassWidth: { value: 0.3 },
    uRealisticMode: { value: 1.0 },
  } as GhibliShaderUniforms,

  vertexShader: /* glsl */ `
    precision highp float;
    precision highp int;

    uniform float uTime;
    uniform float uWindSpeed;
    uniform float uWindStrength;
    uniform float uWindScale;
    uniform float uGrassSway;
    uniform float uGrowthProgress;
    uniform float uGrassRevealProgress;
    uniform float uGrassRevealDistance;
    uniform float uGrassRevealSoftness;
    uniform float uGrassRevealOffset;
    uniform vec3 uGrassRevealDirection;
    uniform vec3 uCameraPosition;
    uniform float uGrassHeight;
    uniform float uGrassWidth;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying float vWindFactor;
    varying float vGrowthFactor;
    varying float vDepth;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                          -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vUv = uv;
      vNormal = normal;
      vPosition = position;

      vec3 transformed = position;

      #ifdef USE_INSTANCING
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      #else
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
      #endif

      vWorldPosition = worldPos.xyz;

      vec3 revealDir = length(uGrassRevealDirection) > 0.001 ? normalize(uGrassRevealDirection) : vec3(0.0, 0.0, -1.0);
      float distanceAhead = dot(worldPos.xyz - uCameraPosition, revealDir);
      float waveFront = uGrassRevealOffset + (uGrassRevealProgress * uGrassRevealDistance);

      float spatialNoise = snoise(worldPos.xz * 0.07) * (uGrassRevealSoftness * 0.3);
      float effectiveDistance = distanceAhead + spatialNoise;

      float behindFade = smoothstep(-150.0, -60.0, distanceAhead);
      float softness = max(1.0, uGrassRevealSoftness);
      float forwardReveal = 1.0 - smoothstep(waveFront - softness, waveFront, effectiveDistance);

      float spatialRevealFactor = forwardReveal * behindFade;
      float combinedProgress = clamp(uGrowthProgress * spatialRevealFactor, 0.0, 1.0);

      float growthFactor = combinedProgress * combinedProgress * (3.0 - 2.0 * combinedProgress);
      vGrowthFactor = growthFactor;

      transformed.y *= growthFactor * uGrassHeight;
      transformed.xz *= mix(0.05, 1.0, growthFactor) * uGrassWidth;

      float heightFactor = clamp(uv.y > 0.0 ? uv.y : max(0.0, position.y), 0.0, 1.0);
      heightFactor = pow(heightFactor, 1.5) * growthFactor;

      if (uGrassSway > 0.0 && heightFactor > 0.05) {
        float time = uTime * uWindSpeed;
        vec2 noiseCoord = worldPos.xz * uWindScale + vec2(time * 0.4, time * 0.3);
        float noiseVal = snoise(noiseCoord);
        
        float gustNoise = snoise(worldPos.xz * 0.05 + vec2(time * 0.8, time * 0.6));
        float totalWind = (noiseVal + gustNoise * 0.5) * uWindStrength * heightFactor;

        transformed.x += totalWind * 0.8;
        transformed.z += totalWind * 0.6;
        transformed.y -= abs(totalWind) * 0.2;
        vWindFactor = totalWind;
      } else {
        vWindFactor = 0.0;
      }

      #ifdef USE_INSTANCING
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
      #else
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      #endif

      vDepth = -mvPosition.z;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: /* glsl */ `
    precision highp float;
    precision highp int;

    uniform mat4 modelMatrix;
    uniform vec3 colorMap[4];
    uniform float brightnessThresholds[3];
    uniform vec3 lightPosition;
    uniform float uSubsurfaceStrength;
    uniform float uRealisticMode;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying float vWindFactor;
    varying float vGrowthFactor;
    varying float vDepth;

    ${atmosphereParsGLSL}

    void main() {
      if (vGrowthFactor < 0.02) {
        discard;
      }

      vec3 worldNormal = normalize(vWorldNormal);
      vec3 lightVector = length(uGlowDir) > 0.001 ? normalize(uGlowDir) : normalize(lightPosition - vWorldPosition);
      vec3 viewVector = normalize(uCamPos - vWorldPosition);

      // Derive dynamic atmosphere lighting components
      vec3 atmoAmbient = mix(uHorizonColor, uZenithColor, 0.35) * max(uAmbientIntensity, 0.15);
      vec3 rimColor = mix(uGlowColor, vec3(1.0), clamp(uRimWhiteMix, 0.0, 1.0));

      vec3 finalRGB;

      if (uRealisticMode > 0.5) {
        float heightRatio = clamp(vUv.y > 0.0 ? vUv.y : max(0.0, vPosition.y / 1.65), 0.0, 1.0);

        vec3 rootColor = colorMap[3];
        vec3 lowerColor = colorMap[2];
        vec3 upperColor = colorMap[1];
        vec3 tipColor = colorMap[0];

        vec3 baseGrassColor = mix(
          mix(rootColor, lowerColor, smoothstep(0.0, 0.35, heightRatio)),
          mix(upperColor, tipColor, smoothstep(0.35, 1.0, heightRatio)),
          smoothstep(0.15, 0.7, heightRatio)
        );

        float patchNoise = sin(vWorldPosition.x * 0.03 + vWorldPosition.z * 0.02) * cos(vWorldPosition.z * 0.04 - vWorldPosition.x * 0.02);
        vec3 tintShift = mix(vec3(0.92, 1.04, 0.88), vec3(1.05, 0.96, 1.08), patchNoise * 0.5 + 0.5);
        baseGrassColor *= tintShift;

        // Atmosphere directional rim & key light
        float NdotL = max(0.0, dot(worldNormal, lightVector));
        float halfLambert = pow(NdotL * 0.5 + 0.5, 1.4);

        float ao = smoothstep(0.0, 0.45, heightRatio) * 0.7 + 0.3;

        // Subsurface scattering glowing with atmosphere light
        float backLight = max(0.0, dot(-lightVector, viewVector));
        float sss = pow(backLight, 2.2) * uSubsurfaceStrength * heightRatio;
        vec3 sssGlow = mix(tipColor, rimColor, 0.5) * sss * 2.0;

        // Lighting equation combining atmosphere ambient, rim backlight, and base blade color
        vec3 lightEnv = atmoAmbient * 2.5 + rimColor * (pow(halfLambert, 1.8) * uRimIntensity * 0.4);
        finalRGB = baseGrassColor * lightEnv * ao + sssGlow;

        if (abs(vWindFactor) > 0.15) {
          finalRGB = mix(finalRGB, tipColor * 1.15, clamp(abs(vWindFactor) * 0.25, 0.0, 0.2));
        }
      } else {
        float NdotL = dot(worldNormal, lightVector);
        float backLight = max(0.0, dot(-lightVector, viewVector));
        float sss = pow(backLight, 3.0) * uSubsurfaceStrength * (vUv.y > 0.0 ? vUv.y : 0.5);
        float totalLight = NdotL + sss;

        vec3 toonBase;
        if (totalLight > brightnessThresholds[0]) {
          toonBase = colorMap[0];
        } else if (totalLight > brightnessThresholds[1]) {
          toonBase = colorMap[1];
        } else if (totalLight > brightnessThresholds[2]) {
          toonBase = colorMap[2];
        } else {
          toonBase = colorMap[3];
        }

        if (abs(vWindFactor) > 0.2) {
          toonBase = mix(toonBase, colorMap[0], clamp(abs(vWindFactor) * 0.3, 0.0, 0.25));
        }

        finalRGB = toonBase * (atmoAmbient * 2.0 + rimColor * 0.5);
      }

      float dist = distance(vWorldPosition, uCamPos);
      finalRGB = applyAtmosphere(finalRGB, dist, vWorldPosition);

      gl_FragColor = vec4(finalRGB, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export const GHIBLI_PALETTES = {
  crimson: {
    name: 'Crimson Atmosphere',
    colors: ['#ff4d4d', '#b3000a', '#660006', '#260002'],
    sky: '#3a0004',
    horizon: '#b3000a',
    ground: '#260002',
    thresholds: [0.65, 0.35, 0.05],
  },
  realistic: {
    name: 'Realistic Lush Meadow',
    colors: ['#8ecc43', '#4d942a', '#2d6124', '#153313'],
    sky: '#6fb0eb',
    horizon: '#d4f0ff',
    ground: '#1c3d18',
    thresholds: [0.65, 0.35, 0.05],
  },
  summer: {
    name: 'Ghibli Summer Meadow',
    colors: ['#88cf6e', '#427062', '#234549', '#142a30'],
    sky: '#6fb0eb',
    horizon: '#d4f0ff',
    ground: '#33594e',
    thresholds: [0.65, 0.35, 0.05],
  },
  sunset: {
    name: 'Golden Hour Sunset',
    colors: ['#ffb347', '#cf6a3c', '#75313d', '#2b1b36'],
    sky: '#4a2545',
    horizon: '#ff9e64',
    ground: '#5c2d38',
    thresholds: [0.6, 0.3, 0.05],
  },
  sakura: {
    name: 'Sakura Blossom',
    colors: ['#ffc2d1', '#e87ea1', '#853e65', '#381c3a'],
    sky: '#9bb1ff',
    horizon: '#e2e2ff',
    ground: '#613a5e',
    thresholds: [0.7, 0.4, 0.05],
  },
  autumn: {
    name: 'Autumn Gold',
    colors: ['#ffd056', '#d67c29', '#8a3c1e', '#361c16'],
    sky: '#5c92ba',
    horizon: '#ffd59e',
    ground: '#613b20',
    thresholds: [0.65, 0.35, 0.05],
  },
  night: {
    name: 'Enchanted Night',
    colors: ['#5ce1e6', '#2b8a8e', '#13404c', '#081721'],
    sky: '#0a1128',
    horizon: '#1c315e',
    ground: '#0f2933',
    thresholds: [0.6, 0.3, 0.05],
  },
};
