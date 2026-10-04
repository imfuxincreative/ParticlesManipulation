import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import { atmosphereParsGLSL } from '@/shaders/atmosphericFog.glsl';
import { atmosphereUniforms } from '@/lib/atmosphereUniforms';

interface GhibliFlowersProps {
  count?: number;
  scale?: number;
  position?: [number, number, number];
  windSpeed?: number;
  windStrength?: number;
  growthProgress?: number;
  autoScrollGrowth?: boolean;
  grassRevealProgress?: number;
  grassRevealDistance?: number;
  grassRevealSoftness?: number;
  grassRevealOffset?: number;
  grassRevealDirection?: THREE.Vector3;
}

const FLOWER_COLORS = [
  '#ff7eb9',
  '#ff9e42',
  '#ffd15c',
  '#ffffff',
  '#b15eff',
  '#ff4d4d',
  '#ff9ebb',
];

export const GhibliFlowers: React.FC<GhibliFlowersProps> = ({
  count = 12000,
  scale = 1.2,
  position = [0, 0, 0],
  windSpeed = 1.2,
  windStrength = 0.3,
  growthProgress,
  autoScrollGrowth = true,
  grassRevealProgress,
  grassRevealDistance = 710,
  grassRevealSoftness = 100,
  grassRevealOffset = 0,
  grassRevealDirection = new THREE.Vector3(0, 0, -1),
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scrollData = useScroll();

  const flowerGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();

    const positions: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    positions.push(0, 0.2, 0);
    uvs.push(0.5, 0.5);
    normals.push(0, 1, 0);

    const numPetals = 5;
    const petalRadius = 0.22;
    const centerRadius = 0.07;

    for (let i = 0; i < numPetals; i++) {
      const angle = (i / numPetals) * Math.PI * 2;
      const nextAngle = ((i + 0.8) / numPetals) * Math.PI * 2;
      const midAngle = (angle + nextAngle) * 0.5;

      const c1x = Math.cos(angle) * centerRadius;
      const c1z = Math.sin(angle) * centerRadius;

      const c2x = Math.cos(nextAngle) * centerRadius;
      const c2z = Math.sin(nextAngle) * centerRadius;

      const px = Math.cos(midAngle) * petalRadius;
      const pz = Math.sin(midAngle) * petalRadius;

      const baseIdx = positions.length / 3;

      positions.push(c1x, 0.15, c1z);
      positions.push(c2x, 0.15, c2z);
      positions.push(px, 0.28, pz);

      uvs.push(0.0, 0.0, 1.0, 0.0, 0.5, 1.0);
      normals.push(0, 0.9, 0.3, 0, 0.9, 0.3, 0, 0.9, 0.3);

      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(400, 0, 0), 2500);

    return geom;
  }, []);

  const uniforms = useMemo(() => {
    return {
      uWindSpeed: { value: windSpeed },
      uWindStrength: { value: windStrength },
      uGrowthProgress: { value: growthProgress ?? 1.0 },
      uGrassRevealProgress: { value: grassRevealProgress ?? 0.0 },
      uGrassRevealDistance: { value: grassRevealDistance },
      uGrassRevealSoftness: { value: grassRevealSoftness },
      uGrassRevealOffset: { value: grassRevealOffset },
      uGrassRevealDirection: { value: grassRevealDirection },
      uCameraPosition: { value: new THREE.Vector3() },
      uFlowerScale: { value: scale },
      ...atmosphereUniforms,
    };
  }, [
    windSpeed,
    windStrength,
    growthProgress,
    grassRevealProgress,
    grassRevealDistance,
    grassRevealSoftness,
    grassRevealOffset,
    grassRevealDirection,
    scale,
  ]);

  const flowerShaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        precision highp float;
        precision highp int;

        uniform float uTime;
        uniform float uWindSpeed;
        uniform float uWindStrength;
        uniform float uGrowthProgress;
        uniform float uGrassRevealProgress;
        uniform float uGrassRevealDistance;
        uniform float uGrassRevealSoftness;
        uniform float uGrassRevealOffset;
        uniform vec3 uGrassRevealDirection;
        uniform vec3 uCameraPosition;
        uniform float uFlowerScale;

        varying vec3 vColor;
        varying vec3 vWorldPosition;
        varying float vGrowthFactor;

        void main() {
          #ifdef USE_INSTANCING
            vColor = instanceColor;
            vec4 worldPos = modelMatrix * instanceMatrix * vec4(position * uFlowerScale, 1.0);
          #else
            vColor = vec3(1.0);
            vec4 worldPos = modelMatrix * vec4(position * uFlowerScale, 1.0);
          #endif

          vWorldPosition = worldPos.xyz;

          vec3 revealDir = length(uGrassRevealDirection) > 0.001 ? normalize(uGrassRevealDirection) : vec3(0.0, 0.0, -1.0);
          float distanceAhead = dot(worldPos.xyz - uCameraPosition, revealDir);
          float waveFront = uGrassRevealOffset + (uGrassRevealProgress * uGrassRevealDistance);

          float behindFade = smoothstep(-150.0, -60.0, distanceAhead);
          float softness = max(1.0, uGrassRevealSoftness);
          float forwardReveal = 1.0 - smoothstep(waveFront - softness, waveFront, distanceAhead);
          float spatialRevealFactor = forwardReveal * behindFade;

          float combinedProgress = clamp(uGrowthProgress * spatialRevealFactor, 0.0, 1.0);
          float growthFactor = combinedProgress * combinedProgress * (3.0 - 2.0 * combinedProgress);
          vGrowthFactor = growthFactor;

          vec3 transformed = position * uFlowerScale * growthFactor;

          float time = uTime * uWindSpeed;
          transformed.x += sin(time * 1.2 + worldPos.x * 0.1) * 0.12 * uWindStrength * growthFactor;
          transformed.z += cos(time * 1.2 + worldPos.z * 0.1) * 0.12 * uWindStrength * growthFactor;

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

        varying vec3 vColor;
        varying vec3 vWorldPosition;
        varying float vGrowthFactor;

        ${atmosphereParsGLSL}

        void main() {
          if (vGrowthFactor < 0.02) {
            discard;
          }
          float dist = distance(vWorldPosition, uCamPos);
          vec3 finalColor = applyAtmosphere(vColor, dist, vWorldPosition);
          gl_FragColor = vec4(finalColor, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.DoubleSide,
    });
  }, [uniforms]);

  React.useEffect(() => {
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uWindSpeed.value = windSpeed;
      u.uWindStrength.value = windStrength;
      u.uFlowerScale.value = scale;
      if (growthProgress !== undefined) u.uGrowthProgress.value = growthProgress;
      if (grassRevealProgress !== undefined) u.uGrassRevealProgress.value = grassRevealProgress;
      if (grassRevealDistance !== undefined) u.uGrassRevealDistance.value = grassRevealDistance;
      if (grassRevealSoftness !== undefined) u.uGrassRevealSoftness.value = grassRevealSoftness;
      if (grassRevealOffset !== undefined) u.uGrassRevealOffset.value = grassRevealOffset;
      if (grassRevealDirection !== undefined) u.uGrassRevealDirection.value = grassRevealDirection;
    }
  }, [
    windSpeed,
    windStrength,
    scale,
    growthProgress,
    grassRevealProgress,
    grassRevealDistance,
    grassRevealSoftness,
    grassRevealOffset,
    grassRevealDirection,
  ]);

  React.useEffect(() => {
    if (!meshRef.current) return;

    const dummy = new THREE.Object3D();
    const colorObj = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const x = -100 + Math.random() * 950;
      const z = (Math.random() - 0.5) * 360;
      const y = 0.8 + Math.random() * 1.4;

      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.x = (Math.random() - 0.5) * 0.2;
      dummy.rotation.z = (Math.random() - 0.5) * 0.2;

      const randomScale = 0.7 + Math.random() * 0.7;
      dummy.scale.set(randomScale, randomScale, randomScale);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const hexColor = FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
      colorObj.set(hexColor);
      meshRef.current.setColorAt(i, colorObj);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [count, flowerGeometry]);

  useFrame((state, delta) => {
    if (!materialRef.current) return;

    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    state.camera.getWorldPosition(camPos);
    state.camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() > 0.001) {
      camDir.normalize();
      materialRef.current.uniforms.uGrassRevealDirection.value.copy(camDir);
    }
    materialRef.current.uniforms.uCameraPosition.value.copy(camPos);

    if (autoScrollGrowth && grassRevealProgress === undefined) {
      const particlesRatio = typeof window !== 'undefined' ? (window as any).particlesScrollRatio : undefined;
      const scrollOffset = (typeof particlesRatio === 'number' && !isNaN(particlesRatio))
        ? particlesRatio
        : (scrollData ? scrollData.offset : 0);

      const targetReveal = Math.min(1.0, Math.max(0.0, scrollOffset));
      let currentReveal = materialRef.current.uniforms.uGrassRevealProgress.value;
      currentReveal += (targetReveal - currentReveal) * 0.15;
      materialRef.current.uniforms.uGrassRevealProgress.value = currentReveal;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[flowerGeometry, undefined, count]}
      position={position}
      frustumCulled={false}
      receiveShadow
      castShadow
    >
      <primitive object={flowerShaderMaterial} ref={materialRef} attach="material" />
    </instancedMesh>
  );
};
