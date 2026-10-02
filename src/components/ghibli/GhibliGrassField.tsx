import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GhibliShader } from '@/shaders/ghibliShader';

interface GhibliGrassFieldProps {
  count?: number;
  radius?: number;
  colors?: string[];
  thresholds?: number[];
  lightPosition?: THREE.Vector3;
  windSpeed?: number;
  windStrength?: number;
  position?: [number, number, number];
  growthProgress?: number; // Optional explicit mount growth override (0.0 to 1.0)
  autoScrollGrowth?: boolean; // If true, links spatial reveal progress to scroll offset
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
  radius = 90,
  colors = ['#8ecc43', '#4d942a', '#2d6124', '#153313'],
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

  // 1. Create High-Detail Tapered 3D Grass Blade Geometry (Plush & Lush width/height)
  const grassGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();

    // 5 vertices: root left, root right, mid left, mid right, tip
    const w = 0.22; // Wider base blade width for gapless carpet density
    const h = 1.65; // Taller base blade height
    
    const positions = new Float32Array([
      -w, 0, 0,       // 0: base left
       w, 0, 0,       // 1: base right
      -w * 0.75, h * 0.5, 0.05, // 2: mid left
       w * 0.75, h * 0.5, 0.05, // 3: mid right
       0, h, 0.15,    // 4: tip curve
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

    return geom;
  }, []);

  // 2. Color Map & Uniforms Setup
  const colorMapValues = useMemo(() => {
    return colors.map((c) => new THREE.Color(c));
  }, [colors]);

  const uniforms = useMemo(() => {
    return {
      colorMap: { value: colorMapValues },
      brightnessThresholds: { value: thresholds },
      lightPosition: { value: lightPosition },
      uTime: { value: 0.0 },
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
    };
  }, [
    colorMapValues,
    thresholds,
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

  // Update uniforms when props change
  React.useEffect(() => {
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.colorMap.value = colorMapValues;
      u.brightnessThresholds.value = thresholds;
      u.lightPosition.value = lightPosition;
      u.uWindSpeed.value = windSpeed;
      u.uWindStrength.value = windStrength;
      u.uGrassHeight.value = grassHeight;
      u.uGrassWidth.value = grassWidth;
      u.uRealisticMode.value = realisticMode ? 1.0 : 0.0;
      if (growthProgress !== undefined) {
        u.uGrowthProgress.value = growthProgress;
      }
      if (grassRevealProgress !== undefined) {
        u.uGrassRevealProgress.value = grassRevealProgress;
      }
      if (grassRevealDistance !== undefined) {
        u.uGrassRevealDistance.value = grassRevealDistance;
      }
      if (grassRevealSoftness !== undefined) {
        u.uGrassRevealSoftness.value = grassRevealSoftness;
      }
      if (grassRevealOffset !== undefined) {
        u.uGrassRevealOffset.value = grassRevealOffset;
      }
      if (grassRevealDirection !== undefined) {
        u.uGrassRevealDirection.value = grassRevealDirection;
      }
    }
  }, [
    colorMapValues,
    thresholds,
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

  // 3. Populate Instanced Mesh Matrices with 100% UNIFORM DENSITY across Full Width (-180 to +180 Z) & Camera Depth (-100 to +850 X)
  React.useEffect(() => {
    if (!meshRef.current) return;

    // Set a wide bounding sphere so Three.js never accidentally culls the instanced mesh
    grassGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(400, 0, 0), 2500);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      // 100% Uniform distribution across full camera depth (-100 to +850 X) and wide sides (-180 to +180 Z)
      // Completely eliminates side patchiness so left, middle, and right sides have identical lush density!
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

  // 4. Animate Wind & Scroll Growth Progress Loop
  useFrame((state, delta) => {
    if (!materialRef.current) return;

    // Advance wind time
    materialRef.current.uniforms.uTime.value += delta;

    // Dynamically track active camera position & look direction vector for shader reveal and behind-camera culling
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    state.camera.getWorldPosition(camPos);
    state.camera.getWorldDirection(camDir);
    camDir.y = 0; // Flatten to ground plane
    if (camDir.lengthSq() > 0.001) {
      camDir.normalize();
      materialRef.current.uniforms.uGrassRevealDirection.value.copy(camDir);
    }
    materialRef.current.uniforms.uCameraPosition.value.copy(camPos);

    // Calculate dynamic spatial reveal from camera scroll
    let currentReveal = materialRef.current.uniforms.uGrassRevealProgress.value;
    if (autoScrollGrowth && grassRevealProgress === undefined) {
      const particlesRatio = typeof window !== 'undefined' ? (window as any).particlesScrollRatio : undefined;
      const scrollOffset = (typeof particlesRatio === 'number' && !isNaN(particlesRatio))
        ? particlesRatio
        : (scrollData ? scrollData.offset : 0);

      // Map scroll offset (0 to 1) directly to reveal progress
      const targetReveal = Math.min(1.0, Math.max(0.0, scrollOffset));
      
      // Liquid-smooth lerp for camera travel reveal wave
      currentReveal += (targetReveal - currentReveal) * 0.15;
      materialRef.current.uniforms.uGrassRevealProgress.value = currentReveal;
    }

    if (typeof window !== 'undefined') {
      const offsetVal = materialRef.current.uniforms.uGrassRevealOffset.value;
      const distVal = materialRef.current.uniforms.uGrassRevealDistance.value;
      (window as any)._grassDebugData = {
        camPos: [camPos.x.toFixed(1), camPos.y.toFixed(1), camPos.z.toFixed(1)],
        camDir: [camDir.x.toFixed(2), '0', camDir.z.toFixed(2)],
        scrollRatio: ((window as any).particlesScrollRatio ?? 0).toFixed(4),
        revealProgress: currentReveal.toFixed(4),
        revealOffset: offsetVal.toFixed(1),
        revealDistance: distVal.toFixed(1),
        waveFront: (offsetVal + currentReveal * distVal).toFixed(1),
      };
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
