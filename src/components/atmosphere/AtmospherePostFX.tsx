"use client";

import React, { forwardRef, useMemo, useLayoutEffect } from "react";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useAtmosphere } from "@/lib/atmosphere";
import { CrimsonGradeEffect } from "@/effects/CrimsonGradeEffect";

const CrimsonGrade = forwardRef<
  CrimsonGradeEffect,
  {
    vignetteColor: string;
    vignetteStrength: number;
    vignetteOffset: number;
    grainAmount: number;
    buildingContrast: number;
  }
>((props, ref) => {
  const effect = useMemo(() => {
    return new CrimsonGradeEffect({
      vignetteColor: new THREE.Color(props.vignetteColor).convertSRGBToLinear(),
      vignetteStrength: props.vignetteStrength,
      vignetteOffset: props.vignetteOffset,
      grainAmount: props.grainAmount,
      buildingContrast: props.buildingContrast,
    });
  }, []);

  useLayoutEffect(() => {
    const vColor = effect.uniforms.get("uVignetteColor");
    if (vColor) vColor.value.set(props.vignetteColor).convertSRGBToLinear();

    const vStrength = effect.uniforms.get("uVignetteStrength");
    if (vStrength) vStrength.value = props.vignetteStrength;

    const vOffset = effect.uniforms.get("uVignetteOffset");
    if (vOffset) vOffset.value = props.vignetteOffset;

    const grain = effect.uniforms.get("uGrainAmount");
    if (grain) grain.value = props.grainAmount;

    const contrast = effect.uniforms.get("uBuildingContrast");
    if (contrast) contrast.value = props.buildingContrast;
  }, [effect, props.vignetteColor, props.vignetteStrength, props.vignetteOffset, props.grainAmount, props.buildingContrast]);

  return <primitive ref={ref} object={effect} dispose={null} />;
});

CrimsonGrade.displayName = "CrimsonGrade";

export const AtmospherePostFX: React.FC = () => {
  const { gl } = useThree();
  const bloomIntensity = useAtmosphere((s) => s.bloomIntensity);
  const bloomThreshold = useAtmosphere((s) => s.bloomThreshold);
  const bloomRadius = useAtmosphere((s) => s.bloomRadius);
  const vignetteStrength = useAtmosphere((s) => s.vignetteStrength);
  const vignetteOffset = useAtmosphere((s) => s.vignetteOffset);
  const grainAmount = useAtmosphere((s) => s.grainAmount);
  const zenithColor = useAtmosphere((s) => s.zenithColor);
  const buildingContrast = useAtmosphere((s) => s.buildingContrast);

  // Validate WebGL context availability to prevent null alpha attribute error on context loss
  const isContextValid = useMemo(() => {
    try {
      if (!gl) return false;
      const ctx = gl.getContext();
      if (!ctx) return false;
      if (typeof ctx.isContextLost === "function" && ctx.isContextLost()) return false;
      if (!ctx.getContextAttributes()) return false;
      return true;
    } catch {
      return false;
    }
  }, [gl]);

  if (!isContextValid) return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        radius={bloomRadius}
      />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <CrimsonGrade
        vignetteColor={zenithColor}
        vignetteStrength={vignetteStrength}
        vignetteOffset={vignetteOffset}
        grainAmount={grainAmount}
        buildingContrast={buildingContrast ?? 1.0}
      />
    </EffectComposer>
  );
};

