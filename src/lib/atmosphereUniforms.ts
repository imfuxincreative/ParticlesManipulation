import * as THREE from "three";
import { AtmosphereConfig, deriveFogColorHex } from "./atmosphere";

export interface AtmosphereUniforms {
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uFogHeightFalloff: { value: number };
  uFogHeightBase: { value: number };
  uFogEnabled: { value: number };
  uFarFadeEnabled: { value: number };
  uFarFadeStart: { value: number };
  uFarFadeEnd: { value: number };
  uFarMinOpacity: { value: number };
  uCamPos: { value: THREE.Vector3 };
  uGlowColor: { value: THREE.Color };
  uGlowDir: { value: THREE.Vector3 };
  uGlowStrength: { value: number };
  uHorizonColor: { value: THREE.Color };
  uZenithColor: { value: THREE.Color };
  uSkyExposure: { value: number };
  uCloudScale: { value: number };
  uCloudSpeed: { value: number };
  uCloudContrast: { value: number };
  uCloudCoverage: { value: number };
  uTime: { value: number };
  uRimIntensity: { value: number };
  uRimWhiteMix: { value: number };
  uAmbientIntensity: { value: number };
  uBuildingContrast: { value: number };
  [key: string]: { value: any };
}

export const atmosphereUniforms: AtmosphereUniforms = {
  uFogColor: { value: new THREE.Color("#E70D18").convertSRGBToLinear() },
  uFogDensity: { value: 0.003 },
  uFogHeightFalloff: { value: 0.02 },
  uFogHeightBase: { value: 8 },
  uFogEnabled: { value: 1.0 },
  uFarFadeEnabled: { value: 1.0 },
  uFarFadeStart: { value: 250.0 },
  uFarFadeEnd: { value: 1400.0 },
  uFarMinOpacity: { value: 0.0 },
  uCamPos: { value: new THREE.Vector3(0, 0, 10) },
  uGlowColor: { value: new THREE.Color("#FF0000").convertSRGBToLinear() },
  uGlowDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
  uGlowStrength: { value: 0.30 },
  uHorizonColor: { value: new THREE.Color("#FF000D").convertSRGBToLinear() },
  uZenithColor: { value: new THREE.Color("#FF0000").convertSRGBToLinear() },
  uSkyExposure: { value: 1.50 },
  uCloudScale: { value: 2.2 },
  uCloudSpeed: { value: 0.04 },
  uCloudContrast: { value: 2.2 },
  uCloudCoverage: { value: 0.60 },
  uTime: { value: 0.0 },
  uRimIntensity: { value: 10.0 },
  uRimWhiteMix: { value: 0.85 },
  uAmbientIntensity: { value: 0.25 },
  uBuildingContrast: { value: 1.0 },
};

const tempColor = new THREE.Color();

export function writeConfigToUniforms(cfg: AtmosphereConfig): void {
  const fogHex = deriveFogColorHex(cfg);
  tempColor.set(fogHex).convertSRGBToLinear();
  atmosphereUniforms.uFogColor.value.copy(tempColor);

  atmosphereUniforms.uFogDensity.value = cfg.fogDensity;
  atmosphereUniforms.uFogHeightFalloff.value = cfg.fogHeightFalloff;
  atmosphereUniforms.uFogHeightBase.value = cfg.fogHeightBase;
  atmosphereUniforms.uFogEnabled.value = cfg.fogEnabled ? 1.0 : 0.0;

  atmosphereUniforms.uFarFadeEnabled.value = (cfg.farFadeEnabled ?? true) ? 1.0 : 0.0;
  atmosphereUniforms.uFarFadeStart.value = cfg.farFadeStart ?? 250.0;
  atmosphereUniforms.uFarFadeEnd.value = cfg.farFadeEnd ?? 1400.0;
  atmosphereUniforms.uFarMinOpacity.value = cfg.farMinOpacity ?? 0.0;

  tempColor.set(cfg.glowColor).convertSRGBToLinear();
  atmosphereUniforms.uGlowColor.value.copy(tempColor);
  atmosphereUniforms.uGlowStrength.value = cfg.glowStrength;

  tempColor.set(cfg.horizonColor).convertSRGBToLinear();
  atmosphereUniforms.uHorizonColor.value.copy(tempColor);

  tempColor.set(cfg.zenithColor).convertSRGBToLinear();
  atmosphereUniforms.uZenithColor.value.copy(tempColor);

  atmosphereUniforms.uSkyExposure.value = cfg.skyExposure;
  atmosphereUniforms.uCloudScale.value = cfg.cloudScale;
  atmosphereUniforms.uCloudSpeed.value = cfg.quality === "low" ? 0.0 : cfg.cloudSpeed;
  atmosphereUniforms.uCloudContrast.value = cfg.cloudContrast;
  atmosphereUniforms.uCloudCoverage.value = cfg.cloudCoverage ?? 0.35;

  if (cfg.glowMode === "fixed") {
    atmosphereUniforms.uGlowDir.value.set(...cfg.glowDirection).normalize();
  }

  atmosphereUniforms.uRimIntensity.value = cfg.rimIntensity;
  atmosphereUniforms.uRimWhiteMix.value = cfg.rimWhiteMix;
  atmosphereUniforms.uAmbientIntensity.value = cfg.ambientIntensity;
  atmosphereUniforms.uBuildingContrast.value = cfg.buildingContrast ?? 1.0;
}
