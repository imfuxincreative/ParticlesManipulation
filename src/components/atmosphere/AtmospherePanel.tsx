"use client";

import React from "react";
import { useAtmosphere, AtmosphereConfig, deriveFogColorHex, REFERENCE_PRESET, DEFAULT_SKY_KEYFRAMES } from "@/lib/atmosphere";
import { Sparkles, Cloud, Sun, Eye, Sliders, RotateCcw, Plus, Trash2, Play, Palette, Zap } from "lucide-react";
import { useLoopTransition } from "@/components/transitions/transitionConfig";
import { brokenLightEngine } from "@/lib/brokenLightFlicker";

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
      className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${value ? "bg-emerald-600" : "bg-slate-800"
        }`}
    >
      <div
        className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${value ? "translate-x-4" : "translate-x-0"
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

const getDecimals = (step: number) => {
  if (step < 0.01) return 3;
  if (step < 0.1) return 2;
  return 1;
};

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, unit = "", onChange }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex justify-between font-mono text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className="text-emerald-300">
        {value.toFixed(getDecimals(step))}
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
  const loopTransition = useLoopTransition();
  const loopCfg = loopTransition.config;

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
      <div className="flex flex-col gap-2.5 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
          <Eye className="w-3.5 h-3.5" />
          <span>Atmospheric Palette</span>
        </div>

        {/* Scroll Horizon Color Timeline Section */}
        <div className="p-2 bg-slate-950/70 border border-emerald-500/30 rounded-lg flex flex-col gap-2">
          <ToggleRow
            label="SCROLL HORIZON COLOR TIMELINE"
            value={atmo.enableScrollHorizonColor ?? true}
            onChange={(v) => set("enableScrollHorizonColor", v)}
          />

          {(atmo.enableScrollHorizonColor ?? true) && (
            <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                  <Palette className="w-3 h-3 text-emerald-400" /> Frame Timeline Keyframes
                </span>
              </div>

              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                {(atmo.horizonColorKeyframes || DEFAULT_SKY_KEYFRAMES)
                  .slice()
                  .sort((a, b) => a.frame - b.frame)
                  .map((kf, idx) => (
                    <div
                      key={kf.id || idx}
                      className="flex items-center justify-between gap-1.5 p-1.5 bg-slate-900/90 border border-white/10 rounded-md font-mono text-[10px]"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[9px] w-4">#{idx + 1}</span>
                        <span className="text-slate-400 text-[9px]">F:</span>
                        <input
                          type="number"
                          value={kf.frame}
                          onChange={(e) =>
                            atmo.updateHorizonKeyframe(kf.id, { frame: parseInt(e.target.value) || 0 })
                          }
                          className="w-14 bg-slate-950 border border-white/15 rounded px-1 py-0.5 text-emerald-300 focus:outline-none focus:border-emerald-500 text-[10px]"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded border border-white/20 relative overflow-hidden flex-shrink-0"
                          style={{ backgroundColor: kf.color }}
                        >
                          <input
                            type="color"
                            value={kf.color}
                            onChange={(e) => atmo.updateHorizonKeyframe(kf.id, { color: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                        <span className="text-[9px] text-slate-300 w-12">{kf.color}</span>

                        {/* Snap to Frame button */}
                        <button
                          title="Snap camera scroll to this frame"
                          onClick={() => {
                            if (typeof window !== "undefined" && (window as any).snapToFrame) {
                              (window as any).snapToFrame(kf.frame);
                            }
                          }}
                          className="p-1 text-emerald-400 hover:text-white bg-slate-800 hover:bg-emerald-600 rounded transition-colors cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                        </button>

                        {/* Delete Keyframe button */}
                        <button
                          title="Remove keyframe"
                          onClick={() => atmo.removeHorizonKeyframe(kf.id)}
                          className="p-1 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              <button
                onClick={() => atmo.addHorizonKeyframe()}
                className="w-full py-1.5 px-2 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-md text-emerald-300 hover:text-white text-[10px] font-mono flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>Add Horizon Color Keyframe</span>
              </button>
            </div>
          )}
        </div>

        {!(atmo.enableScrollHorizonColor ?? true) && (
          <ColorRow label="HORIZON COLOR" value={atmo.horizonColor} onChange={(v) => set("horizonColor", v)} />
        )}
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

      {/* SECTION 1.5: BROKEN LIGHT / FAULTY NEON FLICKER */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-red-500/30 rounded-xl shadow-lg shadow-red-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-red-400 tracking-wider">
            <Zap className="w-3.5 h-3.5 text-red-400 animate-pulse" />
            <span>Broken Light / Faulty Neon</span>
          </div>
          <button
            onClick={() => brokenLightEngine.triggerSparkBurst()}
            className="py-0.5 px-2 bg-red-900/60 hover:bg-red-800/90 border border-red-500/50 rounded text-red-200 text-[9px] font-mono flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            title="Trigger an instant violent electric spark burst"
          >
            <span>SPARK ⚡</span>
          </button>
        </div>

        <ToggleRow
          label="ENABLE BROKEN LIGHT FLICKER"
          value={atmo.brokenLightEnabled ?? true}
          onChange={(v) => set("brokenLightEnabled", v)}
        />

        {(atmo.brokenLightEnabled ?? true) && (
          <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
            {/* SCOPE SELECTOR */}
            <div className="flex justify-between items-center py-0.5 font-mono text-[10px]">
              <span className="text-slate-400">ACTIVE SCENE</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => set("brokenLightScope", "inTouch")}
                  className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${
                    (atmo.brokenLightScope ?? "inTouch") !== "all"
                      ? "bg-red-600 text-white font-bold"
                      : "text-slate-400"
                  }`}
                >
                  IN TOUCH
                </button>
                <button
                  onClick={() => set("brokenLightScope", "all")}
                  className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${
                    atmo.brokenLightScope === "all"
                      ? "bg-red-600 text-white font-bold"
                      : "text-slate-400"
                  }`}
                >
                  ALL SCENES
                </button>
              </div>
            </div>

            {/* STYLE SELECTOR */}
            <div className="flex flex-col gap-1 font-mono text-[10px]">
              <span className="text-slate-400">FLICKER STYLE</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded border border-white/10">
                {[
                  { id: "faulty_neon", label: "FAULTY NEON" },
                  { id: "fluorescent_arc", label: "FLUORESCENT" },
                  { id: "erratic_strobe", label: "ERRATIC STROBE" },
                  { id: "electrical_short", label: "ELECTRIC SHORT" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => set("brokenLightStyle", st.id as any)}
                    className={`py-1 px-1.5 rounded text-[9px] text-center cursor-pointer transition-colors ${
                      (atmo.brokenLightStyle || "faulty_neon") === st.id
                        ? "bg-red-700/80 text-white font-bold border border-red-500/60"
                        : "text-slate-400 hover:text-slate-200 bg-slate-900/50"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <SliderRow
              label="FLICKER INTENSITY"
              value={atmo.brokenLightIntensity ?? 0.9}
              min={0.1}
              max={1.0}
              step={0.05}
              onChange={(v) => set("brokenLightIntensity", v)}
            />
            <SliderRow
              label="GLITCH SPEED / FREQ"
              value={atmo.brokenLightSpeed ?? 1.0}
              min={0.2}
              max={3.0}
              step={0.1}
              unit="x"
              onChange={(v) => set("brokenLightSpeed", v)}
            />
            <SliderRow
              label="ARC OVERDRIVE SURGE"
              value={atmo.brokenLightSurge ?? 1.85}
              min={1.1}
              max={2.5}
              step={0.05}
              unit="x"
              onChange={(v) => set("brokenLightSurge", v)}
            />
          </div>
        )}
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
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${atmo.glowMode === "tracked" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
                }`}
            >
              TRACKED
            </button>
            <button
              onClick={() => set("glowMode", "fixed")}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${atmo.glowMode === "fixed" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
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
        <SliderRow label="AMBIENT INTENSITY" value={atmo.ambientIntensity} min={0.0} max={1.0} step={0.02} onChange={(v) => set("ambientIntensity", v)} />
        <SliderRow label="BUILDING CONTRAST" value={atmo.buildingContrast ?? 1.0} min={0.2} max={3.0} step={0.05} onChange={(v) => set("buildingContrast", v)} />
        <SliderRow label="TOP HERO GLOW" value={atmo.topGlowIntensity} min={0.0} max={12.0} step={0.5} onChange={(v) => set("topGlowIntensity", v)} />

        {/* KEY / FILL LIGHT */}
        <div className="pt-1 border-t border-white/10 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider">Key / Fill Light</span>
          <SliderRow label="KEY FILL INTENSITY" value={atmo.keyFillIntensity} min={0.0} max={2.0} step={0.05} onChange={(v) => set("keyFillIntensity", v)} />
          <SliderRow
            label="KEY FILL POS X"
            value={atmo.keyFillPositionOffset?.[0] ?? 45}
            min={-150}
            max={150}
            step={1}
            unit="u"
            onChange={(v) => {
              const current = atmo.keyFillPositionOffset ?? [45, -50, 72];
              set("keyFillPositionOffset", [v, current[1], current[2]]);
            }}
          />
          <SliderRow
            label="KEY FILL POS Y"
            value={atmo.keyFillPositionOffset?.[1] ?? -50}
            min={-150}
            max={150}
            step={1}
            unit="u"
            onChange={(v) => {
              const current = atmo.keyFillPositionOffset ?? [45, -50, 72];
              set("keyFillPositionOffset", [current[0], v, current[2]]);
            }}
          />
          <SliderRow
            label="KEY FILL POS Z"
            value={atmo.keyFillPositionOffset?.[2] ?? 72}
            min={-150}
            max={150}
            step={1}
            unit="u"
            onChange={(v) => {
              const current = atmo.keyFillPositionOffset ?? [45, -50, 72];
              set("keyFillPositionOffset", [current[0], current[1], v]);
            }}
          />
        </div>

        {/* RIM LIGHT */}
        <div className="pt-1 border-t border-white/10 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider">Rim Backlight</span>
          <SliderRow label="RIM BACKLIGHT INTENSITY" value={atmo.rimIntensity} min={0.0} max={10.0} step={0.5} onChange={(v) => set("rimIntensity", v)} />
          <SliderRow label="RIM WHITE MIX" value={atmo.rimWhiteMix} min={0.0} max={1.0} step={0.05} onChange={(v) => set("rimWhiteMix", v)} />
          <SliderRow
            label="RIM POS X"
            value={atmo.rimPositionOffset?.[0] ?? 60}
            min={-150}
            max={150}
            step={1}
            unit="u"
            onChange={(v) => {
              const current = atmo.rimPositionOffset ?? [60, 10, -150];
              set("rimPositionOffset", [v, current[1], current[2]]);
            }}
          />
          <SliderRow
            label="RIM POS Y"
            value={atmo.rimPositionOffset?.[1] ?? 10}
            min={-150}
            max={150}
            step={1}
            unit="u"
            onChange={(v) => {
              const current = atmo.rimPositionOffset ?? [60, 10, -150];
              set("rimPositionOffset", [current[0], v, current[2]]);
            }}
          />
          <SliderRow
            label="RIM POS Z"
            value={atmo.rimPositionOffset?.[2] ?? -150}
            min={-150}
            max={150}
            step={1}
            unit="u"
            onChange={(v) => {
              const current = atmo.rimPositionOffset ?? [60, 10, -150];
              set("rimPositionOffset", [current[0], current[1], v]);
            }}
          />
        </div>
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
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${atmo.quality === "high" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
                }`}
            >
              HIGH
            </button>
            <button
              onClick={() => set("quality", "low")}
              className={`px-2 py-0.5 rounded text-[9px] cursor-pointer ${atmo.quality === "low" ? "bg-emerald-600 text-white font-bold" : "text-slate-400"
                }`}
            >
              LOW
            </button>
          </div>
        </div>
      </div>

      {/* Loop Transition (Scene Blur) */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Instant Loop Transition (Blur)</span>
          </div>
          <button
            onClick={() => {
              const trigger = (window as any).triggerLoopTransition;
              if (trigger) trigger("forward");
              else loopTransition.triggerTransition("forward");
            }}
            disabled={loopTransition.isTransitioning}
            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[9px] font-mono rounded font-medium transition-colors cursor-pointer"
          >
            {loopTransition.isTransitioning ? "BLURRING..." : "TEST LOOP"}
          </button>
        </div>

        <ToggleRow
          label="ENABLE LOOP TRANSITION"
          value={loopCfg.enabled}
          onChange={(v) => loopTransition.updateConfig({ enabled: v })}
        />
        <SliderRow
          label="MAX BLUR (PX)"
          value={loopCfg.maxBlurPx}
          min={10}
          max={80}
          step={2}
          unit="px"
          onChange={(v) => loopTransition.updateConfig({ maxBlurPx: v })}
        />
        <SliderRow
          label="RAMP ZONE (FRAMES)"
          value={loopCfg.zoneFrames ?? 200}
          min={40}
          max={400}
          step={10}
          unit=" fr"
          onChange={(v) => loopTransition.updateConfig({ zoneFrames: v })}
        />
        <SliderRow
          label="FOG VEIL DENSITY"
          value={loopCfg.maxFogDensity ?? 0.075}
          min={0.01}
          max={0.15}
          step={0.005}
          unit=""
          onChange={(v) => loopTransition.updateConfig({ maxFogDensity: v })}
        />
        <SliderRow
          label="TEST LOOP DURATION"
          value={loopCfg.duration}
          min={300}
          max={1500}
          step={50}
          unit="ms"
          onChange={(v) => loopTransition.updateConfig({ duration: v })}
        />
        <ToggleRow
          label="WEBGL OPTICAL BOKEH PASS"
          value={loopCfg.useShaderBlur}
          onChange={(v) => loopTransition.updateConfig({ useShaderBlur: v })}
        />
      </div>
    </div>
  );
};
