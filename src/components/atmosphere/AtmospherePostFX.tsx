"use client";

import React, { forwardRef, useMemo, useLayoutEffect } from "react";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
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
  }
>((props, ref) => {
  const effect = useMemo(() => {
    return new CrimsonGradeEffect({
      vignetteColor: new THREE.Color(props.vignetteColor).convertSRGBToLinear(),
      vignetteStrength: props.vignetteStrength,
      vignetteOffset: props.vignetteOffset,
      grainAmount: props.grainAmount,
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
  }, [effect, props.vignetteColor, props.vignetteStrength, props.vignetteOffset, props.grainAmount]);

  return <primitive ref={ref} object={effect} dispose={null} />;
});

CrimsonGrade.displayName = "CrimsonGrade";

export const AtmospherePostFX: React.FC = () => {
  const bloomIntensity = useAtmosphere((s) => s.bloomIntensity);
  const bloomThreshold = useAtmosphere((s) => s.bloomThreshold);
  const bloomRadius = useAtmosphere((s) => s.bloomRadius);
  const vignetteStrength = useAtmosphere((s) => s.vignetteStrength);
  const vignetteOffset = useAtmosphere((s) => s.vignetteOffset);
  const grainAmount = useAtmosphere((s) => s.grainAmount);
  const zenithColor = useAtmosphere((s) => s.zenithColor);

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
      />
    </EffectComposer>
  );
};
