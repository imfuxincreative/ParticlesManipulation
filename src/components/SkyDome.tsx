"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { atmosphereUniforms } from "@/lib/atmosphereUniforms";
import { skyDomeVertexShader, skyDomeFragmentShader } from "@/shaders/skyDome.glsl";
import { useAtmosphere } from "@/lib/atmosphere";

export const SkyDome: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const quality = useAtmosphere((s) => s.quality);
  const skyEnabled = useAtmosphere((s) => s.skyEnabled);

  const material = useMemo(() => {
    const octaves = quality === "low" ? 3 : 5;
    return new THREE.ShaderMaterial({
      vertexShader: skyDomeVertexShader,
      fragmentShader: skyDomeFragmentShader,
      uniforms: { ...atmosphereUniforms },
      defines: { CLOUD_OCTAVES: octaves },
      side: THREE.BackSide,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
      fog: false,
    });
  }, [quality]);

  useFrame((state) => {
    if (meshRef.current) {
      // Follow WORLD position ONLY (camera is parented to an animated GLB node)
      state.camera.getWorldPosition(meshRef.current.position);
    }
  });

  if (!skyEnabled) return null;

  return (
    <mesh ref={meshRef} renderOrder={-1000} material={material} frustumCulled={false}>
      <sphereGeometry args={[800, 32, 16]} />
    </mesh>
  );
};
