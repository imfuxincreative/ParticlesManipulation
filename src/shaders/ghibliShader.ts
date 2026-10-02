import * as THREE from 'three';

export interface GhibliShaderUniforms {
  colorMap: { value: THREE.Color[] };
  brightnessThresholds: { value: number[] };
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
  [key: string]: { value: any };
}

export const GhibliShader = {
  uniforms: {
    colorMap: {
      value: [
        new THREE.Color('#8ecc43'), // Highlight (Fresh vibrant tip green)
        new THREE.Color('#4d942a'), // Upper (Lush meadow green)
        new THREE.Color('#2d6124'), // Lower (Rich forest green)
        new THREE.Color('#153313'), // Shadow (Deep soil root green)
      ],
    },
    brightnessThresholds: {
      value: [0.65, 0.35, 0.05],
    },
    lightPosition: { value: new THREE.Vector3(15, 20, 15) },
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.2 },
    uWindStrength: { value: 0.3 },
    uWindScale: { value: 0.15 },
    uGrassSway: { value: 1.0 },
    uGrowthProgress: { value: 1.0 }, // 0.0 = sprouted, 1.0 = full height
    uSubsurfaceStrength: { value: 0.25 },
    uGrassRevealProgress: { value: 0.0 },
    uGrassRevealDistance: { value: 710.0 },
    uGrassRevealSoftness: { value: 100.0 },
    uGrassRevealOffset: { value: 0.0 },
    uGrassRevealDirection: { value: new THREE.Vector3(0.0, 0.0, -1.0) },
    uCameraPosition: { value: new THREE.Vector3(0.0, 0.0, 0.0) },
    uGrassHeight: { value: 1.7 },
    uGrassWidth: { value: 0.3 },
    uRealisticMode: { value: 1.0 }, // 1.0 = Realistic smooth meadow, 0.0 = Cel Quantized
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

    // 2D Simplex-like noise helper for organic wind and growth movement
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

      // Calculate global world position for continuous spatial wind noise and reveal wave across instances
      #ifdef USE_INSTANCING
        vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      #else
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
      #endif

      vWorldPosition = worldPos.xyz;

      // ─── SPATIAL SCROLL REVEAL WAVE ───
      // Camera look direction vector (horizontal ground plane)
      vec3 revealDir = length(uGrassRevealDirection) > 0.001 ? normalize(uGrassRevealDirection) : vec3(0.0, 0.0, -1.0);
      
      // Distance of grass vertex ahead of camera position along look direction vector
      float distanceAhead = dot(worldPos.xyz - uCameraPosition, revealDir);

      // Current reveal wave front distance ahead of camera
      float waveFront = uGrassRevealOffset + (uGrassRevealProgress * uGrassRevealDistance);

      // Organic spatial noise for natural meadow patchiness
      float spatialNoise = snoise(worldPos.xz * 0.07) * (uGrassRevealSoftness * 0.3);
      float effectiveDistance = distanceAhead + spatialNoise;

      // Behind-camera fade out: grass more than 60-150 units behind camera fades out
      float behindFade = smoothstep(-150.0, -60.0, distanceAhead);

      // Forward reveal wave: 1.0 in front of camera up to waveFront, 0.0 unrevealed far ahead
      float softness = max(1.0, uGrassRevealSoftness);
      float forwardReveal = 1.0 - smoothstep(waveFront - softness, waveFront, effectiveDistance);

      // Combined reveal factor (1.0 = grown in view, 0.0 = discarded behind camera or far ahead)
      float spatialRevealFactor = forwardReveal * behindFade;

      // Combine mount growth progress with scroll-based spatial reveal
      float combinedProgress = clamp(uGrowthProgress * spatialRevealFactor, 0.0, 1.0);

      // Existing smooth cubic curve for natural sprout emergence
      float growthFactor = combinedProgress * combinedProgress * (3.0 - 2.0 * combinedProgress);
      vGrowthFactor = growthFactor;

      // Scale height and width based on combined growth progress + user uGrassHeight and uGrassWidth uniforms
      transformed.y *= growthFactor * uGrassHeight;
      transformed.xz *= mix(0.05, 1.0, growthFactor) * uGrassWidth;

      // Wind displacement logic
      // Height factor ensures grass/leaves bend more towards top (y > 0)
      float heightFactor = clamp(uv.y > 0.0 ? uv.y : max(0.0, position.y), 0.0, 1.0);
      heightFactor = pow(heightFactor, 1.5) * growthFactor; // Wind only affects grown grass

      if (uGrassSway > 0.0 && heightFactor > 0.05) {
        float time = uTime * uWindSpeed;
        vec2 noiseCoord = worldPos.xz * uWindScale + vec2(time * 0.4, time * 0.3);
        float noiseVal = snoise(noiseCoord);
        
        float gustNoise = snoise(worldPos.xz * 0.05 + vec2(time * 0.8, time * 0.6));
        float totalWind = (noiseVal + gustNoise * 0.5) * uWindStrength * heightFactor;

        transformed.x += totalWind * 0.8;
        transformed.z += totalWind * 0.6;
        transformed.y -= abs(totalWind) * 0.2; // Slight dip when bending
        vWindFactor = totalWind;
      } else {
        vWindFactor = 0.0;
      }

      #ifdef USE_INSTANCING
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
      #else
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      #endif

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

    void main() {
      // Hide un-grown grass blades
      if (vGrowthFactor < 0.02) {
        discard;
      }

      vec3 worldNormal = normalize(vWorldNormal);
      vec3 lightVector = normalize(lightPosition - vWorldPosition);
      vec3 viewVector = normalize(cameraPosition - vWorldPosition);

      if (uRealisticMode > 0.5) {
        // ─── REALISTIC LUSH MEADOW SHADING ───
        float heightRatio = clamp(vUv.y > 0.0 ? vUv.y : max(0.0, vPosition.y / 1.65), 0.0, 1.0);

        // Smooth vertical root-to-tip gradient
        vec3 rootColor = colorMap[3];
        vec3 lowerColor = colorMap[2];
        vec3 upperColor = colorMap[1];
        vec3 tipColor = colorMap[0];

        vec3 baseGrassColor = mix(
          mix(rootColor, lowerColor, smoothstep(0.0, 0.35, heightRatio)),
          mix(upperColor, tipColor, smoothstep(0.35, 1.0, heightRatio)),
          smoothstep(0.15, 0.7, heightRatio)
        );

        // Micro spatial color variation across landscape
        float patchNoise = sin(vWorldPosition.x * 0.03 + vWorldPosition.z * 0.02) * cos(vWorldPosition.z * 0.04 - vWorldPosition.x * 0.02);
        vec3 tintShift = mix(vec3(0.92, 1.04, 0.88), vec3(1.05, 0.96, 1.08), patchNoise * 0.5 + 0.5);
        baseGrassColor *= tintShift;

        // Smooth Half-Lambert diffuse lighting
        float NdotL = max(0.0, dot(worldNormal, lightVector));
        float halfLambert = NdotL * 0.5 + 0.5;
        float diffuseLight = pow(halfLambert, 1.4);

        // Ambient Occlusion shadow at blade root
        float ao = smoothstep(0.0, 0.45, heightRatio) * 0.7 + 0.3;

        // Subsurface scattering (sun shining through translucent blade tips)
        float backLight = max(0.0, dot(-lightVector, viewVector));
        float sss = pow(backLight, 2.5) * uSubsurfaceStrength * heightRatio;
        vec3 sssGlow = tipColor * sss * 1.8;

        // Combine realistic lighting components
        vec3 finalRGB = baseGrassColor * (diffuseLight * 0.85 + 0.25) * ao + sssGlow;

        // Dynamic wind wave shimmer
        if (abs(vWindFactor) > 0.15) {
          finalRGB = mix(finalRGB, tipColor * 1.15, clamp(abs(vWindFactor) * 0.25, 0.0, 0.2));
        }

        gl_FragColor = vec4(finalRGB, 1.0);
      } else {
        // ─── GHIBLI TOON QUANTIZED SHADING ───
        float brightness = dot(worldNormal, lightVector);
        float backLight = max(0.0, dot(-lightVector, viewVector));
        float sss = pow(backLight, 3.0) * uSubsurfaceStrength * (vUv.y > 0.0 ? vUv.y : 0.5);
        float totalLight = brightness + sss;

        vec4 finalColor;
        if (totalLight > brightnessThresholds[0]) {
          finalColor = vec4(colorMap[0], 1.0);
        } else if (totalLight > brightnessThresholds[1]) {
          finalColor = vec4(colorMap[1], 1.0);
        } else if (totalLight > brightnessThresholds[2]) {
          finalColor = vec4(colorMap[2], 1.0);
        } else {
          finalColor = vec4(colorMap[3], 1.0);
        }

        if (abs(vWindFactor) > 0.2) {
          finalColor.rgb = mix(finalColor.rgb, colorMap[0], clamp(abs(vWindFactor) * 0.3, 0.0, 0.25));
        }

        gl_FragColor = finalColor;
      }
    }
  `,
};

// Preset Color Palettes
export const GHIBLI_PALETTES = {
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
