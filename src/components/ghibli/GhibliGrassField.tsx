import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import { GhibliShader, colorsToFloat32Array, thresholdsToFloat32Array } from '@/shaders/ghibliShader';
import { atmosphereUniforms } from '@/lib/atmosphereUniforms';

interface GhibliGrassFieldProps {
  count?: number;
  radius?: number;
  colors?: string[];
  thresholds?: number[];
  lightPosition?: THREE.Vector3;
  windSpeed?: number;
  windStrength?: number;
  position?: [number, number, number];
  growthProgress?: number;
  autoScrollGrowth?: boolean;
  grassRevealProgress?: number;
  grassRevealDistance?: number;
  grassRevealSoftness?: number;
  grassRevealOffset?: number;
  grassRevealDirection?: THREE.Vector3;
  grassHeight?: number;
  grassWidth?: number;
  realisticMode?: boolean;
}

export const GhibliGrassField: React.FC<GhibliGrassFieldProps> = ({
  count = 500000,
  colors = ['#ff4d4d', '#b3000a', '#660006', '#260002'],
  thresholds = [0.65, 0.35, 0.05],
  lightPosition = new THREE.Vector3(15, 20, 15),
  windSpeed = 1.2,
  windStrength = 0.3,
  position = [0, 0, 0],
  growthProgress,
  autoScrollGrowth = true,
  grassRevealProgress,
  grassRevealDistance = 710,
  grassRevealSoftness = 100,
  grassRevealOffset = 0,
  grassRevealDirection = new THREE.Vector3(0, 0, -1),
  grassHeight = 1.7,
  grassWidth = 0.3,
  realisticMode = true,
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scrollData = useScroll();

  const grassGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const w = 0.22;
    const h = 1.65;
    
    const positions = new Float32Array([
      -w, 0, 0,
       w, 0, 0,
      -w * 0.75, h * 0.5, 0.05,
       w * 0.75, h * 0.5, 0.05,
       0, h, 0.15,
    ]);

    const uvs = new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.1, 0.5,
      0.9, 0.5,
      0.5, 1.0,
    ]);

    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0.2, 0.98,
      0, 0.2, 0.98,
      0, 0.4, 0.92,
    ]);

    const indices = new Uint16Array([
      0, 1, 2,
      1, 3, 2,
      2, 3, 4,
    ]);

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(400, 0, 0), 2500);

    return geom;
  }, []);

  const colorMapFloat32 = useMemo(() => {
    return colorsToFloat32Array(colors);
  }, [colors]);

  const thresholdsFloat32 = useMemo(() => {
    return thresholdsToFloat32Array(thresholds);
  }, [thresholds]);

  const uniforms = useMemo(() => {
    return {
      colorMap: { value: colorMapFloat32 },
      brightnessThresholds: { value: thresholdsFloat32 },
      lightPosition: { value: lightPosition.clone() },
      uWindSpeed: { value: windSpeed },
      uWindStrength: { value: windStrength },
      uWindScale: { value: 0.12 },
      uGrassSway: { value: 1.0 },
      uGrowthProgress: { value: growthProgress ?? 1.0 },
      uSubsurfaceStrength: { value: 0.35 },
      uGrassRevealProgress: { value: grassRevealProgress ?? 0.0 },
      uGrassRevealDistance: { value: grassRevealDistance },
      uGrassRevealSoftness: { value: grassRevealSoftness },
      uGrassRevealOffset: { value: grassRevealOffset },
      uGrassRevealDirection: { value: grassRevealDirection },
      uCameraPosition: { value: new THREE.Vector3() },
      uGrassHeight: { value: grassHeight },
      uGrassWidth: { value: grassWidth },
      uRealisticMode: { value: realisticMode ? 1.0 : 0.0 },
      ...atmosphereUniforms,
    };
  }, [
    colorMapFloat32,
    thresholdsFloat32,
    lightPosition,
    windSpeed,
    windStrength,
    growthProgress,
    grassRevealProgress,
    grassRevealDistance,
    grassRevealSoftness,
    grassRevealOffset,
    grassRevealDirection,
    grassHeight,
    grassWidth,
    realisticMode,
  ]);

  React.useEffect(() => {
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      if (u.colorMap) u.colorMap.value = colorMapFloat32;
      if (u.brightnessThresholds) u.brightnessThresholds.value = thresholdsFloat32;
      if (u.lightPosition && u.lightPosition.value) u.lightPosition.value.copy(lightPosition);
      if (u.uWindSpeed) u.uWindSpeed.value = windSpeed;
      if (u.uWindStrength) u.uWindStrength.value = windStrength;
      if (u.uGrassHeight) u.uGrassHeight.value = grassHeight;
      if (u.uGrassWidth) u.uGrassWidth.value = grassWidth;
      if (u.uRealisticMode) u.uRealisticMode.value = realisticMode ? 1.0 : 0.0;
      if (growthProgress !== undefined && u.uGrowthProgress) {
        u.uGrowthProgress.value = growthProgress;
      }
      if (grassRevealProgress !== undefined && u.uGrassRevealProgress) {
        u.uGrassRevealProgress.value = grassRevealProgress;
      }
      if (grassRevealDistance !== undefined && u.uGrassRevealDistance) {
        u.uGrassRevealDistance.value = grassRevealDistance;
      }
      if (grassRevealSoftness !== undefined && u.uGrassRevealSoftness) {
        u.uGrassRevealSoftness.value = grassRevealSoftness;
      }
      if (grassRevealOffset !== undefined && u.uGrassRevealOffset) {
        u.uGrassRevealOffset.value = grassRevealOffset;
      }
      if (grassRevealDirection !== undefined && u.uGrassRevealDirection) {
        u.uGrassRevealDirection.value = grassRevealDirection;
      }
    }
  }, [
    colorMapFloat32,
    thresholdsFloat32,
    lightPosition,
    windSpeed,
    windStrength,
    growthProgress,
    grassRevealProgress,
    grassRevealDistance,
    grassRevealSoftness,
    grassRevealOffset,
    grassRevealDirection,
    grassHeight,
    grassWidth,
    realisticMode,
  ]);

  React.useEffect(() => {
    if (!meshRef.current) return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = -100 + Math.random() * 950;
      const z = (Math.random() - 0.5) * 360;
      const y = 0;

      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.x = (Math.random() - 0.5) * 0.3;
      dummy.rotation.z = (Math.random() - 0.5) * 0.3;

      const scaleY = 0.85 + Math.random() * 0.95;
      const scaleXZ = 0.9 + Math.random() * 0.7;
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, grassGeometry]);

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

    let currentReveal = materialRef.current.uniforms.uGrassRevealProgress.value;
    if (autoScrollGrowth && grassRevealProgress === undefined) {
      const particlesRatio = typeof window !== 'undefined' ? (window as any).particlesScrollRatio : undefined;
      const scrollOffset = (typeof particlesRatio === 'number' && !isNaN(particlesRatio))
        ? particlesRatio
        : (scrollData ? scrollData.offset : 0);

      const targetReveal = Math.min(1.0, Math.max(0.0, scrollOffset));
      currentReveal += (targetReveal - currentReveal) * 0.15;
      materialRef.current.uniforms.uGrassRevealProgress.value = currentReveal;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[grassGeometry, undefined, count]}
      position={position}
      frustumCulled={false}
      receiveShadow
      castShadow
    >
      <shaderMaterial
        ref={materialRef}
        attach="material"
        vertexShader={GhibliShader.vertexShader}
        fragmentShader={GhibliShader.fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
};
