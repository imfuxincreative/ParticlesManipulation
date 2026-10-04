"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";
import { hedgePillarVertexShader, hedgePillarFragmentShader } from "@/shaders/hedgePillar.glsl";
import { useAtmosphere } from "@/lib/atmosphere";

interface PillarProps {
  position: [number, number, number];
  size: [number, number, number]; // width, height, depth
  twist: number;
  isHero?: boolean;
}

const Pillar: React.FC<PillarProps> = ({ position, size, twist, isHero = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [w, h, d] = size;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: hedgePillarVertexShader,
      fragmentShader: hedgePillarFragmentShader,
      uniforms: {
        ...atmosphereUniforms,
        uTwistAmount: { value: twist },
        uHeight: { value: h },
        uIsHero: { value: isHero ? 1.0 : 0.0 },
      },
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }, [twist, h, isHero]);

  return (
    <mesh ref={meshRef} position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={[w, h, d, 16, 64, 16]} />
    </mesh>
  );
};

export const DepthLayers: React.FC = () => {
  const setHeroTopPosition = useAtmosphere((s) => s.setHeroTopPosition);

  // Position hero top position in world coordinates
  useEffect(() => {
    // Hero pillar is at [5, -10, -40], height 50 -> top is around Y = 15
    setHeroTopPosition([5, 15, -40]);
  }, [setHeroTopPosition]);

  return (
    <group>
      {/* Hero Pillar (foreground, crisp with bright lit top) */}
      <Pillar
        position={[5, -10, -40]}
        size={[12, 50, 12]}
        twist={0.4}
        isHero={true}
      />

      {/* Mid-ground Pillar (medium distance silhouette) */}
      <Pillar
        position={[-35, -20, -110]}
        size={[16, 70, 16]}
        twist={0.25}
        isHero={false}
      />

      {/* Far-ground Pillar (deep silhouette fading into crimson haze) */}
      <Pillar
        position={[-75, -30, -220]}
        size={[20, 90, 20]}
        twist={0.15}
        isHero={false}
      />
    </group>
  );
};
