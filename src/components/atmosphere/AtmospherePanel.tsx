"use client";

import React from "react";
import { useAtmosphere, AtmosphereConfig, deriveFogColorHex, REFERENCE_PRESET } from "@/lib/atmosphere";
import { Sparkles, Cloud, Sun, Eye, Sliders, RotateCcw } from "lucide-react";

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, value, onChange }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-slate-400 font-mono text-[10px]">{label}</span>
    <button
      onClick={() => onChange(!value)}
      className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${
        value ? "bg-emerald-600" : "bg-slate-800"
      }`}
    >
      <div
        className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
          value ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, unit = "", onChange }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex justify-between font-mono text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className="text-emerald-300">
        {value.toFixed(step < 0.1 ? 2 : 1)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
    />
  </div>
);

interface ColorRowProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange?: (hex: string) => void;
}

const ColorRow: React.FC<ColorRowProps> = ({ label, value, disabled = false, onChange }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-400 font-mono text-[10px]">{label}</span>
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-white/20 relative overflow-hidden"
        style={{ backgroundColor: value }}
      >
        {!disabled && onChange && (
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        )}
      </div>
      <span className="text-[10px] text-slate-300 font-mono w-14">{value}</span>
    </div>
  </div>
);

export const AtmospherePanel: React.FC = () => {
  const atmo = useAtmosphere();
  const set = atmo.set;

  const derivedFogHex = deriveFogColorHex(atmo);

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Preset Reset Button */}
      <button
        onClick={() => atmo.applyPreset(REFERENCE_PRESET)}
        className="py-2 px-3 bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 rounded-xl text-red-200 font-semibold text-[11px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
      >
        <RotateCcw className="w-3.5 h-3.5 text-red-400" />
        <span>Reset to Crimson Reference Preset</span>
      </button>

      {/* SECTION 1: COLORS */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Eye className="w-3.5 h-3.5" />
          <span>Atmospheric Palette</span>
        </div>
        <ColorRow label="HORIZON COLOR" value={atmo.horizonColor} onChange={(v) => set("horizonColor", v)} />
        <ColorRow label="ZENITH COLOR" value={atmo.zenithColor} onChange={(v) => set("zenithColor", v)} />
        <ColorRow label="GLOW COLOR" value={atmo.glowColor} onChange={(v) => set("glowColor", v)} />

        <ToggleRow label="DECOUPLE FOG COLOR" value={atmo.decoupleFog} onChange={(v) => set("decoupleFog", v)} />
        <ColorRow
          label={atmo.decoupleFog ? "FOG OVERRIDE" : "DERIVED FOG 🔒"}
          value={derivedFogHex}
          disabled={!atmo.decoupleFog}
          onChange={(v) => atmo.decoupleFog && set("fogColorOverride", v)}
        />
      </div>

      {/* SECTION 2: FOG */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Cloud className="w-3.5 h-3.5" />
          <span>Height & Perspective Fog</span>
        </div>
        <ToggleRow label="ENABLE FOG" value={atmo.fogEnabled} onChange={(v) => set("fogEnabled", v)} />
        <SliderRow label="FOG DENSITY" value={atmo.fogDensity} min={0.001} max={0.04} step={0.001} onChange={(v) => set("fogDensity", v)} />
        <SliderRow label="HEIGHT FALLOFF" value={atmo.fogHeightFalloff} min={0.005} max={0.1} step={0.005} onChange={(v) => set("fogHeightFalloff", v)} />
        <SliderRow label="HEIGHT BASE Y" value={atmo.fogHeightBase} min={-20} max={20} step={1} unit="u" onChange={(v) => set("fogHeightBase", v)} />
      </div>

      {/* SECTION 2.5: DISTANCE DEPTH & OPACITY FADE */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-emerald-500/20 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Distance Depth & Opacity Fade</span>
        </div>
        <ToggleRow label="ENABLE FAR ALPHA FADE" value={atmo.farFadeEnabled ?? true} onChange={(v) => set("farFadeEnabled", v)} />
        <SliderRow label="FADE START DIST" value={atmo.farFadeStart ?? 250} min={50} max={2000} step={10} unit="u" onChange={(v) => set("farFadeStart", v)} />
        <SliderRow label="FADE END DIST" value={atmo.farFadeEnd ?? 1400} min={100} max={4000} step={50} unit="u" onChange={(v) => set("farFadeEnd", v)} />
        <SliderRow label="FAR MIN OPACITY" value={atmo.farMinOpacity ?? 0.0} min={0.0} max={1.0} step={0.05} onChange={(v) => set("farMinOpacity", v)} />
      </div>

      {/* SECTION 3: SKY */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Sun className="w-3.5 h-3.5" />
          <span>Sky Dome & Clouds</span>
        </div>
        <ToggleRow label="ENABLE SKY" value={atmo.skyEnabled} onChange={(v) => set("skyEnabled", v)} />
        <SliderRow label="SKY EXPOSURE" value={atmo.skyExposure} min={0.5} max={1.5} step={0.05} onChange={(v) => set("skyExposure", v)} />
        <SliderRow label="GLOW STRENGTH" value={atmo.glowStrength} min={0.1} max={1.2} step={0.05} onChange={(v) => set("glowStrength", v)} />

        <div className="flex justify-between items-center py-1 font-mono text-[10px]">
          <span className="text-slate-400">GLOW MODE</span>
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded border border-white/10">
            <button
              onClick={() => set("glowMode", "tracked")}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${
                atmo.glowMode === "tracked" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
              }`}
            >
              TRACKED
            </button>
            <button
              onClick={() => set("glowMode", "fixed")}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${
                atmo.glowMode === "fixed" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
              }`}
            >
              FIXED
            </button>
          </div>
        </div>

        <SliderRow label="CLOUD AMOUNT" value={atmo.cloudCoverage ?? 0.35} min={0.0} max={1.0} step={0.05} onChange={(v) => set("cloudCoverage", v)} />
        <SliderRow label="CLOUD SCALE" value={atmo.cloudScale} min={0.4} max={3.0} step={0.1} onChange={(v) => set("cloudScale", v)} />
        <SliderRow label="CLOUD SPEED" value={atmo.cloudSpeed} min={0.0} max={0.05} step={0.005} onChange={(v) => set("cloudSpeed", v)} />
        <SliderRow label="CLOUD CONTRAST" value={atmo.cloudContrast} min={0.5} max={2.5} step={0.1} onChange={(v) => set("cloudContrast", v)} />
      </div>

      {/* SECTION 4: LIGHTING */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Sliders className="w-3.5 h-3.5" />
          <span>Atmosphere Lighting</span>
        </div>
        <SliderRow label="AMBIENT INTENSITY" value={atmo.ambientIntensity} min={0.05} max={0.6} step={0.05} onChange={(v) => set("ambientIntensity", v)} />
        <SliderRow label="BUILDING CONTRAST" value={atmo.buildingContrast ?? 1.0} min={0.2} max={3.0} step={0.05} onChange={(v) => set("buildingContrast", v)} />
        <SliderRow label="RIM BACKLIGHT" value={atmo.rimIntensity} min={1.0} max={10.0} step={0.5} onChange={(v) => set("rimIntensity", v)} />
        <SliderRow label="RIM WHITE MIX" value={atmo.rimWhiteMix} min={0.0} max={1.0} step={0.05} onChange={(v) => set("rimWhiteMix", v)} />
        <SliderRow label="KEY FILL INTENSITY" value={atmo.keyFillIntensity} min={0.0} max={1.0} step={0.05} onChange={(v) => set("keyFillIntensity", v)} />
        <SliderRow label="TOP HERO GLOW" value={atmo.topGlowIntensity} min={0.0} max={12.0} step={0.5} onChange={(v) => set("topGlowIntensity", v)} />
      </div>

      {/* SECTION 5: POST PROCESSING */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Post Processing & FX</span>
        </div>
        <SliderRow label="BLOOM INTENSITY" value={atmo.bloomIntensity} min={0.0} max={2.0} step={0.05} onChange={(v) => set("bloomIntensity", v)} />
        <SliderRow label="BLOOM THRESHOLD" value={atmo.bloomThreshold} min={0.2} max={1.2} step={0.05} onChange={(v) => set("bloomThreshold", v)} />
        <SliderRow label="BLOOM RADIUS" value={atmo.bloomRadius} min={0.1} max={1.5} step={0.05} onChange={(v) => set("bloomRadius", v)} />
        <SliderRow label="LIGHT CONTRAST" value={atmo.buildingContrast ?? 1.0} min={0.2} max={3.0} step={0.05} onChange={(v) => set("buildingContrast", v)} />
        <SliderRow label="VIGNETTE STRENGTH" value={atmo.vignetteStrength} min={0.0} max={1.5} step={0.05} onChange={(v) => set("vignetteStrength", v)} />
        <SliderRow label="VIGNETTE OFFSET" value={atmo.vignetteOffset} min={0.0} max={0.6} step={0.05} onChange={(v) => set("vignetteOffset", v)} />
        <SliderRow label="FILM GRAIN" value={atmo.grainAmount} min={0.0} max={0.3} step={0.01} onChange={(v) => set("grainAmount", v)} />

        <div className="flex justify-between items-center py-1 font-mono text-[10px]">
          <span className="text-slate-400">QUALITY TARGET</span>
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded border border-white/10">
            <button
              onClick={() => set("quality", "high")}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${
                atmo.quality === "high" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
              }`}
            >
              HIGH
            </button>
            <button
              onClick={() => set("quality", "low")}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${
                atmo.quality === "low" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
              }`}
            >
              LOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
