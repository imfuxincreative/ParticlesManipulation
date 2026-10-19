"use client";

import React, { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useAtmosphere, deriveFogColorHex, getInterpolatedHorizonColor } from "@/lib/atmosphere";
import { atmosphereUniforms, writeConfigToUniforms } from "@/lib/atmosphereUniforms";
import { useLoopTransition } from "@/components/transitions/transitionConfig";

const tempColor = new THREE.Color();
const tempZenithColor = new THREE.Color();
const tempFogColor = new THREE.Color();

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

    // Dynamic scroll horizon color timeline keyframe evaluation
    const currentFrame = (typeof window !== "undefined" && (window as any).particlesCurrentFrame !== undefined)
      ? (window as any).particlesCurrentFrame
      : -493;

    if (config.enableScrollHorizonColor && config.horizonColorKeyframes && config.horizonColorKeyframes.length > 0) {
      getInterpolatedHorizonColor(config.horizonColorKeyframes, currentFrame, atmosphereUniforms.uHorizonColor.value);
    } else {
      tempColor.set(config.horizonColor).convertSRGBToLinear();
      atmosphereUniforms.uHorizonColor.value.copy(tempColor);
    }

    // Query loop transition state (0.0 = normal, 1.0 = peak obscurement at loop cut)
    const loopStore = useLoopTransition.getState();
    const isInTouch = loopStore.activeScene === "inTouch";
    const isTransitioning = loopStore.isTransitioning;
    const loopProgress = loopStore.transitionProgress;
    const loopConfig = loopStore.config;

    // Modulate fog density up to maximum right before loop to dissolve building geometry into the atmospheric color
    const baseFogDensity = config.fogDensity;
    const maxFogDensity = loopConfig?.maxFogDensity ?? 0.075;
    const fogPow = Math.pow(loopProgress, 1.2);

    let effectiveFogDensity = baseFogDensity;
    if (isInTouch) {
      effectiveFogDensity = isTransitioning
        ? THREE.MathUtils.lerp(0.003, maxFogDensity, fogPow)
        : 0.003;
    } else if (loopProgress > 0.001) {
      effectiveFogDensity = THREE.MathUtils.lerp(baseFogDensity, maxFogDensity, fogPow);
    }

    atmosphereUniforms.uFogDensity.value = effectiveFogDensity;

    // Single source of truth for scene fog & background
    let fogLinearColor: THREE.Color;
    if (config.decoupleFog) {
      fogLinearColor = tempColor.set(config.fogColorOverride).convertSRGBToLinear();
      atmosphereUniforms.uFogColor.value.copy(fogLinearColor);
    } else {
      // In linear space, fog is 85% horizon + 15% zenith unless decoupled
      const zenithLinear = tempZenithColor.set(config.zenithColor).convertSRGBToLinear();
      fogLinearColor = tempFogColor.copy(atmosphereUniforms.uHorizonColor.value).lerp(zenithLinear, 0.15);
      atmosphereUniforms.uFogColor.value.copy(fogLinearColor);
    }

    if (config.fogEnabled || loopProgress > 0.001) {
      if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
        scene.fog = new THREE.FogExp2(fogLinearColor, effectiveFogDensity);
      } else {
        scene.fog.color.copy(fogLinearColor);
        scene.fog.density = effectiveFogDensity;
      }
    } else {
      scene.fog = null;
    }

    if (scene.background && (scene.background as any).isColor) {
      (scene.background as THREE.Color).copy(fogLinearColor);
    } else {
      scene.background = fogLinearColor.clone();
    }

    // Keep lighting vibrant and visible during loop transition (no blackout),
    // and gently lift ambient lighting so shadowed faces catch radiant atmosphere tone
    const ambientBoost = 1.0 + loopProgress * 0.45;
    atmosphereUniforms.uSkyExposure.value = config.skyExposure;
    atmosphereUniforms.uAmbientIntensity.value = config.ambientIntensity * ambientBoost;
    atmosphereUniforms.uRimIntensity.value = config.rimIntensity;
  });

  return null;
};

