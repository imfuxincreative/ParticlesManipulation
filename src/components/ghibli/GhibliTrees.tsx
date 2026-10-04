import React, { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GhibliShader, colorsToFloat32Array, thresholdsToFloat32Array } from '@/shaders/ghibliShader';
import { atmosphereUniforms } from '@/lib/atmosphereUniforms';

interface GhibliTreesProps {
  colors?: string[];
  thresholds?: number[];
  lightPosition?: THREE.Vector3;
  windSpeed?: number;
  windStrength?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
}

export const GhibliTrees: React.FC<GhibliTreesProps> = ({
  colors = ['#88cf6e', '#427062', '#234549', '#142a30'],
  thresholds = [0.65, 0.35, 0.05],
  lightPosition = new THREE.Vector3(15, 20, 15),
  windSpeed = 1.2,
  windStrength = 0.25,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}) => {
  const { nodes } = useGLTF('/trees.glb') as any;
  const materialRef = useRef<THREE.ShaderMaterial>(null);

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
      uWindScale: { value: 0.08 },
      uGrassSway: { value: 1.0 },
      uGrowthProgress: { value: 1.0 },
      uSubsurfaceStrength: { value: 0.2 },
      uGrassRevealProgress: { value: 1.0 },
      uGrassRevealDistance: { value: 500.0 },
      uGrassRevealSoftness: { value: 30.0 },
      uGrassRevealOffset: { value: 250.0 },
      uGrassRevealDirection: { value: new THREE.Vector3(0, 0, -1) },
      uCameraPosition: { value: new THREE.Vector3(0, 0, 0) },
      ...atmosphereUniforms,
    };
  }, [colorMapFloat32, thresholdsFloat32, lightPosition, windSpeed, windStrength]);

  React.useEffect(() => {
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      if (u.colorMap) u.colorMap.value = colorMapFloat32;
      if (u.brightnessThresholds) u.brightnessThresholds.value = thresholdsFloat32;
      if (u.lightPosition && u.lightPosition.value) u.lightPosition.value.copy(lightPosition);
      if (u.uWindSpeed) u.uWindSpeed.value = windSpeed;
      if (u.uWindStrength) u.uWindStrength.value = windStrength;
    }
  }, [colorMapFloat32, thresholdsFloat32, lightPosition, windSpeed, windStrength]);

  const FoliageGeometry = nodes?.Foliage?.geometry;

  if (!FoliageGeometry) {
    return null;
  }

  return (
    <group position={position} rotation={rotation} scale={scale} dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={FoliageGeometry}
        position={[0.33, -0.05, -0.68]}
      >
        <shaderMaterial
          ref={materialRef}
          attach="material"
          vertexShader={GhibliShader.vertexShader}
          fragmentShader={GhibliShader.fragmentShader}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

useGLTF.preload('/trees.glb');
