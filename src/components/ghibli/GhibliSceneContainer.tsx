import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { GhibliGrassField } from './GhibliGrassField';
import { GhibliTrees } from './GhibliTrees';
import { GhibliGround } from './GhibliGround';
import { GHIBLI_PALETTES } from '@/shaders/ghibliShader';

interface SceneProps {
  paletteKey?: keyof typeof GHIBLI_PALETTES;
  customColors?: string[];
  windSpeed?: number;
  windStrength?: number;
  grassCount?: number;
  lightPos?: [number, number, number];
  autoRotate?: boolean;
}

const TreeGroup: React.FC<{
  colors: string[];
  thresholds: number[];
  lightVec: THREE.Vector3;
  windSpeed: number;
  windStrength: number;
  autoRotate?: boolean;
}> = ({ colors, thresholds, lightVec, windSpeed, windStrength, autoRotate }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  // Secondary tree foliage tint offset
  const secondaryColors = useMemo(() => {
    const c0 = new THREE.Color(colors[0]).clone().offsetHSL(0.04, 0.05, 0.03).getHexString();
    const c1 = new THREE.Color(colors[1]).clone().offsetHSL(0.03, 0, 0).getHexString();
    return [`#${c0}`, `#${c1}`, colors[2], colors[3]];
  }, [colors]);

  return (
    <group ref={groupRef}>
      {/* Central Hero Trees */}
      <GhibliTrees
        position={[0, 0, -2]}
        scale={1.2}
        colors={colors}
        thresholds={thresholds}
        lightPosition={lightVec}
        windSpeed={windSpeed}
        windStrength={windStrength}
      />

      <GhibliTrees
        position={[3.5, 0, 3.5]}
        rotation={[0, Math.PI * 0.4, 0]}
        scale={1.0}
        colors={secondaryColors}
        thresholds={thresholds}
        lightPosition={lightVec}
        windSpeed={windSpeed}
        windStrength={windStrength}
      />

      <GhibliTrees
        position={[-4.2, 0, 1.8]}
        rotation={[0, -Math.PI * 0.3, 0]}
        scale={0.9}
        colors={colors}
        thresholds={thresholds}
        lightPosition={lightVec}
        windSpeed={windSpeed}
        windStrength={windStrength}
      />

      <GhibliTrees
        position={[1.8, 0, -5.5]}
        rotation={[0, Math.PI * 0.7, 0]}
        scale={1.1}
        colors={secondaryColors}
        thresholds={thresholds}
        lightPosition={lightVec}
        windSpeed={windSpeed}
        windStrength={windStrength}
      />
    </group>
  );
};

// React helper memoization for tree colors
import { useMemo } from 'react';

export const GhibliSceneContent: React.FC<SceneProps> = ({
  paletteKey = 'summer',
  customColors,
  windSpeed = 1.2,
  windStrength = 0.3,
  grassCount = 20000,
  lightPos = [15, 20, 15],
  autoRotate = false,
}) => {
  const palette = GHIBLI_PALETTES[paletteKey] || GHIBLI_PALETTES.summer;
  const activeColors = customColors || palette.colors;
  const lightVec = useMemo(() => new THREE.Vector3(...lightPos), [lightPos]);

  return (
    <>
      {/* Lighting Setup */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={lightPos}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />

      {/* Dynamic Sky Background */}
      <color attach="background" args={[palette.sky]} />
      <Sky
        sunPosition={lightPos}
        turbidity={6}
        rayleigh={1.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {/* Ghibli Foliage & Tree Cluster */}
      <TreeGroup
        colors={activeColors}
        thresholds={palette.thresholds}
        lightVec={lightVec}
        windSpeed={windSpeed}
        windStrength={windStrength}
        autoRotate={autoRotate}
      />

      {/* Instanced Ghibli Grass Meadow */}
      <GhibliGrassField
        count={grassCount}
        radius={22}
        colors={activeColors}
        thresholds={palette.thresholds}
        lightPosition={lightVec}
        windSpeed={windSpeed}
        windStrength={windStrength}
      />

      {/* Ground Base */}
      <GhibliGround color={palette.ground} size={80} />

      {/* Orbit Camera Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2 - 0.02} // Prevent camera clipping ground
        minDistance={3}
        maxDistance={40}
        target={[0, 1.5, 0]}
      />
    </>
  );
};

export const GhibliSceneContainer: React.FC<SceneProps> = (props) => {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 5, 12], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    >
      <GhibliSceneContent {...props} />
    </Canvas>
  );
};
