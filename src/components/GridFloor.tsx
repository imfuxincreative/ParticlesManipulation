"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { GhibliGrassField } from "./ghibli/GhibliGrassField";
import { GhibliFlowers } from "./ghibli/GhibliFlowers";
import { GhibliTrees } from "./ghibli/GhibliTrees";
import { GHIBLI_PALETTES } from "@/shaders/ghibliShader";

interface GridFloorProps {
  projectionBounds?: { min: number; max: number };
}

export const GridFloor: React.FC<GridFloorProps> = () => {
  const { settings } = useSimulation();

  // Active Ghibli palette & light vector
  const palette = useMemo(() => {
    return GHIBLI_PALETTES[settings.ghibliPaletteKey as keyof typeof GHIBLI_PALETTES] || GHIBLI_PALETTES.realistic;
  }, [settings.ghibliPaletteKey]);

  const lightVec = useMemo(() => new THREE.Vector3(15, 20, 15), []);

  return (
    <group>
      {/* Visual Base Ground Plane Mesh covering the full city ground */}
      {(settings.groundOpacity ?? 1.0) > 0.001 && (
        <mesh
          position={[0, settings.gridFloorY - 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial
            color={settings.groundColor || palette.ground}
            transparent={(settings.groundOpacity ?? 1.0) < 0.99}
            opacity={settings.groundOpacity ?? 1.0}
            roughness={0.85}
            metalness={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Ghibli Instanced Grass Field on the Grid Floor */}
      {(settings.showGhibliGrass ?? true) && (
        <GhibliGrassField
          count={settings.ghibliGrassCount ?? 500000}
          radius={settings.ghibliGrassRadius ?? 120}
          colors={palette.colors}
          thresholds={palette.thresholds}
          lightPosition={lightVec}
          windSpeed={settings.ghibliGrassWindSpeed ?? 1.2}
          windStrength={settings.ghibliGrassWindStrength ?? 0.3}
          position={[0, settings.gridFloorY, 0]}
          autoScrollGrowth={true}
          grassRevealDistance={settings.ghibliGrassRevealDistance ?? 710}
          grassRevealSoftness={settings.ghibliGrassRevealSoftness ?? 100}
          grassRevealOffset={settings.ghibliGrassRevealOffset ?? 0}
          grassHeight={settings.ghibliGrassHeight ?? 1.7}
          grassWidth={settings.ghibliGrassWidth ?? 0.3}
          realisticMode={settings.useRealisticGrass ?? true}
        />
      )}

      {/* Ghibli Instanced Meadow Flowers amongst the Grass */}
      {(settings.showGhibliFlowers ?? true) && (
        <GhibliFlowers
          count={settings.ghibliFlowerCount ?? 12000}
          scale={settings.ghibliFlowerScale ?? 1.2}
          windSpeed={settings.ghibliGrassWindSpeed ?? 1.2}
          windStrength={settings.ghibliGrassWindStrength ?? 0.3}
          position={[0, settings.gridFloorY, 0]}
          autoScrollGrowth={true}
          grassRevealDistance={settings.ghibliGrassRevealDistance ?? 710}
          grassRevealSoftness={settings.ghibliGrassRevealSoftness ?? 100}
          grassRevealOffset={settings.ghibliGrassRevealOffset ?? 0}
        />
      )}

      {/* Ghibli Trees Cluster on the Grid Floor */}
      {(settings.showGhibliTrees ?? true) && (
        <group position={[0, settings.gridFloorY, 0]}>
          <GhibliTrees
            position={[18, 0, -15]}
            scale={1.5}
            colors={palette.colors}
            thresholds={palette.thresholds}
            lightPosition={lightVec}
            windSpeed={settings.ghibliGrassWindSpeed ?? 1.2}
            windStrength={settings.ghibliGrassWindStrength ?? 0.3}
          />
          <GhibliTrees
            position={[-22, 0, 20]}
            rotation={[0, Math.PI * 0.4, 0]}
            scale={1.3}
            colors={palette.colors}
            thresholds={palette.thresholds}
            lightPosition={lightVec}
            windSpeed={settings.ghibliGrassWindSpeed ?? 1.2}
            windStrength={settings.ghibliGrassWindStrength ?? 0.3}
          />
          <GhibliTrees
            position={[25, 0, 18]}
            rotation={[0, -Math.PI * 0.3, 0]}
            scale={1.4}
            colors={palette.colors}
            thresholds={palette.thresholds}
            lightPosition={lightVec}
            windSpeed={settings.ghibliGrassWindSpeed ?? 1.2}
            windStrength={settings.ghibliGrassWindStrength ?? 0.3}
          />
          <GhibliTrees
            position={[-18, 0, -25]}
            rotation={[0, Math.PI * 0.7, 0]}
            scale={1.6}
            colors={palette.colors}
            thresholds={palette.thresholds}
            lightPosition={lightVec}
            windSpeed={settings.ghibliGrassWindSpeed ?? 1.2}
            windStrength={settings.ghibliGrassWindStrength ?? 0.3}
          />
        </group>
      )}
    </group>
  );
};

