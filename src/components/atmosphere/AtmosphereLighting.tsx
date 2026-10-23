"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAtmosphere } from "@/lib/atmosphere";
import { brokenLightEngine } from "@/lib/brokenLightFlicker";

export const AtmosphereLighting: React.FC = () => {
  const ambientIntensity = useAtmosphere((s) => s.ambientIntensity);
  const rimIntensity = useAtmosphere((s) => s.rimIntensity);
  const rimWhiteMix = useAtmosphere((s) => s.rimWhiteMix);
  const keyFillIntensity = useAtmosphere((s) => s.keyFillIntensity);
  const topGlowIntensity = useAtmosphere((s) => s.topGlowIntensity);
  const zenithColorHex = useAtmosphere((s) => s.zenithColor);
  const glowColorHex = useAtmosphere((s) => s.glowColor);
  const heroTopPosition = useAtmosphere((s) => s.heroTopPosition);
  const rimPositionOffset = useAtmosphere((s) => s.rimPositionOffset ?? [60, 10, -150]);
  const keyFillPositionOffset = useAtmosphere((s) => s.keyFillPositionOffset ?? [45, -50, 72]);
  const quality = useAtmosphere((s) => s.quality);

  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const topGlowLightRef = useRef<THREE.PointLight>(null);
  const heroTargetRef = useRef<THREE.Object3D>(null);

  const ambientColor = useMemo(() => {
    return new THREE.Color(zenithColorHex).convertSRGBToLinear();
  }, [zenithColorHex]);

  const rimColor = useMemo(() => {
    const cGlow = new THREE.Color(glowColorHex).convertSRGBToLinear();
    const cWhite = new THREE.Color("#ffffff");
    return cGlow.lerp(cWhite, rimWhiteMix);
  }, [glowColorHex, rimWhiteMix]);

  useFrame(() => {
    const atmo = useAtmosphere.getState();
    const isBrokenScope = atmo.brokenLightEnabled && atmo.brokenLightScope === "all";
    const mult = isBrokenScope ? brokenLightEngine.getMultiplier() : 1.0;

    if (ambientLightRef.current) ambientLightRef.current.intensity = ambientIntensity * mult;
    if (rimLightRef.current) rimLightRef.current.intensity = rimIntensity * mult;
    if (topGlowLightRef.current) topGlowLightRef.current.intensity = topGlowIntensity * mult;
  });

  const mapSize = quality === "low" ? 1024 : 2048;

  return (
    <group>
      {/* Target for directional rim light */}
      <object3D ref={heroTargetRef} position={heroTopPosition} />

      {/* Ambient fill tinted toward zenith color */}
      <ambientLight ref={ambientLightRef} color={ambientColor} intensity={ambientIntensity} />

      {/* Rim Directional Backlight */}
      <directionalLight
        ref={rimLightRef}
        position={[
          heroTopPosition[0] + rimPositionOffset[0],
          heroTopPosition[1] + rimPositionOffset[1],
          heroTopPosition[2] + rimPositionOffset[2],
        ]}
        target={heroTargetRef.current || undefined}
        color={rimColor}
        intensity={rimIntensity}
        castShadow
        shadow-mapSize-width={mapSize}
        shadow-mapSize-height={mapSize}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={40}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0005}
      />

      {/* Top Hot Point Light over Hero Pillar */}
      <pointLight
        ref={topGlowLightRef}
        position={[
          heroTopPosition[0],
          heroTopPosition[1] + 3,
          heroTopPosition[2],
        ]}
        color={rimColor}
        intensity={topGlowIntensity}
        distance={35}
        decay={2}
      />

      {/* Key / Fill Light */}
      <directionalLight
        position={[
          heroTopPosition[0] + keyFillPositionOffset[0],
          heroTopPosition[1] + keyFillPositionOffset[1],
          heroTopPosition[2] + keyFillPositionOffset[2],
        ]}
        color="#ffffff"
        intensity={keyFillIntensity}
      />
    </group>
  );
};
