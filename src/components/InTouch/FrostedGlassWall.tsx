"use client";

import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAtmosphere } from "@/lib/atmosphere";
import { FrostedGlassShader } from "@/shaders/frostedGlassShader";

interface FrostedGlassWallProps {
  hand1PosRef?: React.MutableRefObject<THREE.Vector3 | null>;
  hand2PosRef?: React.MutableRefObject<THREE.Vector3 | null>;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
}

export const FrostedGlassWall: React.FC<FrostedGlassWallProps> = ({
  hand1PosRef,
  hand2PosRef,
  position = [0, 8.156, 2.736],
  rotation = [Math.PI / 2, 0, 0],
  scale = 12.202,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  const { nodes } = useGLTF("/inTouch.glb") as any;

  const horizonColor = useAtmosphere((s) => s.horizonColor);
  const zenithColor = useAtmosphere((s) => s.zenithColor);
  const fogColorOverride = useAtmosphere((s) => s.fogColorOverride);
  const glowColor = useAtmosphere((s) => s.glowColor);

  const uniforms = useMemo(() => {
    return {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uHorizonColor: { value: new THREE.Color(horizonColor) },
      uZenithColor: { value: new THREE.Color(zenithColor) },
      uFogColor: { value: new THREE.Color(fogColorOverride || "#E70D18") },
      uGlowColor: { value: new THREE.Color(glowColor || "#FF1A1A") },
      uContactPoint1: { value: new THREE.Vector2(0.5, 0.5) },
      uContactPoint2: { value: new THREE.Vector2(0.5, 0.5) },
      uContactDistance1: { value: 1.0 },
      uContactDistance2: { value: 1.0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseHover: { value: 0.0 },
      uRippleCenter: { value: new THREE.Vector2(-10.0, -10.0) },
      uRippleTime: { value: -1.0 },
      uRoughness: { value: 0.65 },
      uGrainStrength: { value: 0.16 },
      uOpacity: { value: 0.94 },
    };
  }, []);

  const tempVec = useMemo(() => new THREE.Vector3(), []);
  const tempPlanePos = useMemo(() => new THREE.Vector3(...position), [position]);

  useFrame((_, delta) => {
    if (!materialRef.current || !meshRef.current) return;
    const mat = materialRef.current;

    mat.uniforms.uTime.value += delta;
    mat.uniforms.uResolution.value.set(size.width, size.height);

    mat.uniforms.uHorizonColor.value.set(horizonColor);
    mat.uniforms.uZenithColor.value.set(zenithColor);
    mat.uniforms.uFogColor.value.set(fogColorOverride || "#E70D18");
    mat.uniforms.uGlowColor.value.set(glowColor || "#FF1A1A");

    // Ripple time progression
    if (mat.uniforms.uRippleTime.value >= 0.0) {
      mat.uniforms.uRippleTime.value += delta;
      if (mat.uniforms.uRippleTime.value > 2.5) {
        mat.uniforms.uRippleTime.value = -1.0;
      }
    }

    // Map Hand 1 world position onto glass plane UV coordinates
    const planeScaleVal = typeof scale === "number" ? scale * 2.0 : scale[0] * 2.0;

    if (hand1PosRef?.current) {
      tempVec.copy(hand1PosRef.current);
      // Distance from glass plane (Y axis in Blender space where plane normal is -Y)
      const distFromGlass = Math.abs(tempVec.y - tempPlanePos.y);
      mat.uniforms.uContactDistance1.value = THREE.MathUtils.clamp(distFromGlass, 0.0, 2.0);

      // Local UV coordinates on plane
      const u = (tempVec.x - tempPlanePos.x) / planeScaleVal + 0.5;
      const v = (tempVec.z - tempPlanePos.z) / planeScaleVal + 0.5;
      mat.uniforms.uContactPoint1.value.set(
        THREE.MathUtils.clamp(u, 0.0, 1.0),
        THREE.MathUtils.clamp(v, 0.0, 1.0)
      );
    }

    if (hand2PosRef?.current) {
      tempVec.copy(hand2PosRef.current);
      const distFromGlass = Math.abs(tempVec.y - tempPlanePos.y);
      mat.uniforms.uContactDistance2.value = THREE.MathUtils.clamp(distFromGlass, 0.0, 2.0);

      const u = (tempVec.x - tempPlanePos.x) / planeScaleVal + 0.5;
      const v = (tempVec.z - tempPlanePos.z) / planeScaleVal + 0.5;
      mat.uniforms.uContactPoint2.value.set(
        THREE.MathUtils.clamp(u, 0.0, 1.0),
        THREE.MathUtils.clamp(v, 0.0, 1.0)
      );
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerMove={(e) => {
        if (!materialRef.current) return;
        if (e.uv) {
          materialRef.current.uniforms.uMouse.value.copy(e.uv);
          materialRef.current.uniforms.uMouseHover.value = 1.0;
        }
      }}
      onPointerLeave={() => {
        if (!materialRef.current) return;
        materialRef.current.uniforms.uMouseHover.value = 0.0;
      }}
      onPointerDown={(e) => {
        if (!materialRef.current) return;
        if (e.uv) {
          materialRef.current.uniforms.uRippleCenter.value.copy(e.uv);
          materialRef.current.uniforms.uRippleTime.value = 0.0;
        }
      }}
    >
      {nodes?.blurglass?.geometry ? (
        <primitive object={nodes.blurglass.geometry} attach="geometry" />
      ) : (
        <planeGeometry args={[2, 2, 64, 64]} />
      )}
      <shaderMaterial
        ref={materialRef}
        vertexShader={FrostedGlassShader.vertexShader}
        fragmentShader={FrostedGlassShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
