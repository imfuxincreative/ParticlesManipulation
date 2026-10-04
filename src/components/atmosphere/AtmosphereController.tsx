"use client";

import React, { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useAtmosphere, deriveFogColorHex } from "@/lib/atmosphere";
import { atmosphereUniforms, writeConfigToUniforms } from "@/lib/atmosphereUniforms";

export const AtmosphereController: React.FC = () => {
  const { scene, camera } = useThree();
  const config = useAtmosphere();
  const heroTopRef = useRef<THREE.Vector3>(new THREE.Vector3(...config.heroTopPosition));

  // Handle SSR/persist rehydration and initial sync
  useEffect(() => {
    useAtmosphere.persist.rehydrate();
  }, []);

  // Write config values to singleton uniforms whenever config updates
  useEffect(() => {
    writeConfigToUniforms(config);
    heroTopRef.current.set(...config.heroTopPosition);
  }, [config]);

  // Main per-frame atmosphere sync loop
  useFrame((_, delta) => {
    atmosphereUniforms.uTime.value += delta;

    // Camera world position sync
    camera.getWorldPosition(atmosphereUniforms.uCamPos.value);

    // Tracked glow direction calculation
    if (config.glowMode === "tracked") {
      atmosphereUniforms.uGlowDir.value
        .copy(heroTopRef.current)
        .sub(atmosphereUniforms.uCamPos.value)
        .normalize();
    }

    // Single source of truth for scene fog & background
    const fogHex = deriveFogColorHex(config);
    const fogLinearColor = new THREE.Color(fogHex).convertSRGBToLinear();

    if (config.fogEnabled) {
      if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
        scene.fog = new THREE.FogExp2(fogLinearColor, config.fogDensity);
      } else {
        scene.fog.color.copy(fogLinearColor);
        scene.fog.density = config.fogDensity;
      }
    } else {
      scene.fog = null;
    }

    if (scene.background && (scene.background as any).isColor) {
      (scene.background as THREE.Color).copy(fogLinearColor);
    } else {
      scene.background = fogLinearColor.clone();
    }
  });

  return null;
};
