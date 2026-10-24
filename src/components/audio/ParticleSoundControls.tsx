"use client";

import React, { useEffect, useState } from "react";
import { Volume2, RotateCcw, Activity, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { SimulationSettings } from "@/context/SimulationContext";
import { particleSoundEngine } from "@/lib/audio/ParticleSoundEngine";
import { SOUND_PRESETS, ParticleSoundPreset, DEFAULT_SOUND_SETTINGS, SoundTelemetry } from "@/lib/audio/SoundParams";

interface ParticleSoundControlsProps {
  settings: SimulationSettings;
  updateSetting: <K extends keyof SimulationSettings>(key: K, value: SimulationSettings[K]) => void;
  updateSettings: (newSettings: Partial<SimulationSettings>) => void;
}

export const ParticleSoundControls: React.FC<ParticleSoundControlsProps> = ({
  settings,
  updateSetting,
  updateSettings,
}) => {
  const [telemetry, setTelemetry] = useState<SoundTelemetry>({
    energy: 0,
    speedNorm: 0,
    densityNorm: 0,
    distanceNorm: 0,
    grainRate: 0,
    currentPitchHz: 2600,
    activeVoices: 0,
  });

  const showDebug = settings.particleAudioDebug ?? false;

  useEffect(() => {
    if (!showDebug) return;
    const interval = setInterval(() => {
      setTelemetry(particleSoundEngine.getTelemetry());
    }, 60);
    return () => clearInterval(interval);
  }, [showDebug]);

  const handlePresetSelect = (preset: ParticleSoundPreset) => {
    const p = SOUND_PRESETS[preset];
    if (!p) return;

    updateSettings({
      particleSoundPreset: preset,
      particleDustVolume: p.dustVolume ?? 0.42,
      particleSparkleIntensity: p.sparkleIntensity ?? 0.35,
      particleAudioTail: p.tailTime ?? 0.38,
      particleRelease: p.releaseTime ?? 0.38,
      particleTickDensity: p.crackleDensity ?? 180,
      particleTickSharpness: p.crackleSharpness ?? 1.15,
      particleVolumeCurve: p.volumeCurve ?? 1.35,
    });

    particleSoundEngine.updateSettings({
      preset,
      dustVolume: p.dustVolume,
      sparkleIntensity: p.sparkleIntensity,
      dustToneHz: p.dustToneHz,
      sparkleFreqHz: p.sparkleFreqHz,
      crackleDensity: p.crackleDensity,
      crackleSharpness: p.crackleSharpness,
      tailTime: p.tailTime,
    });
  };

  const handleResetDefaults = () => {
    updateSettings({
      particleSoundVolume: DEFAULT_SOUND_SETTINGS.masterVolume,
      particleDustVolume: DEFAULT_SOUND_SETTINGS.dustVolume,
      particleSparkleIntensity: DEFAULT_SOUND_SETTINGS.sparkleIntensity,
      particleAudioTail: DEFAULT_SOUND_SETTINGS.tailTime,
      particleSpeedSensitivity: DEFAULT_SOUND_SETTINGS.speedSensitivity,
      particleVolumeCurve: DEFAULT_SOUND_SETTINGS.volumeCurve,
      particleTickDensity: DEFAULT_SOUND_SETTINGS.crackleDensity,
      particleTickSharpness: DEFAULT_SOUND_SETTINGS.crackleSharpness,
      particleAttack: DEFAULT_SOUND_SETTINGS.attackTime,
      particleRelease: DEFAULT_SOUND_SETTINGS.releaseTime,
      particleSoundPreset: "velvet",
    });

    particleSoundEngine.updateSettings(DEFAULT_SOUND_SETTINGS);
  };

  const tailTime = settings.particleAudioTail ?? 0.38;
  const speedSens = settings.particleSpeedSensitivity ?? settings.particleMotionSensitivity ?? 1.0;
  const volCurve = settings.particleVolumeCurve ?? 1.35;
  const crackleDensity = settings.particleTickDensity ?? 180;
  const crackleSharpness = settings.particleTickSharpness ?? 1.15;
  const dustVol = settings.particleDustVolume ?? 0.42;
  const sparkleInt = settings.particleSparkleIntensity ?? 0.35;

  return (
    <div className="flex flex-col gap-2.5 p-2.5 bg-slate-900/60 border border-purple-500/20 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Digital Particle Sound Texture</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleResetDefaults}
            title="Reset audio settings to factory defaults"
            className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            RESET
          </button>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-500/30 text-purple-300 uppercase">
            {(settings.particleSoundPreset ?? "velvet")}
          </span>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="flex flex-col gap-1">
        <span className="text-slate-400 font-mono text-[9px]">PARTICLE TEXTURE PRESETS</span>
        <div className="grid grid-cols-4 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 font-mono text-[8.5px] tracking-tight">
          {[
            { id: "velvet", label: "VELVET" },
            { id: "tactile", label: "TACTILE" },
            { id: "stardust", label: "STARDUST" },
            { id: "plasma", label: "PLASMA" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetSelect(p.id as ParticleSoundPreset)}
              className={`py-1 rounded text-center transition-all cursor-pointer ${(settings.particleSoundPreset ?? "velvet") === p.id
                ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-slate-200"
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Master Toggle */}
      <div className="flex justify-between items-center py-0.5">
        <span className="text-slate-400 font-mono text-[10px]">ENABLE PARTICLE AUDIO</span>
        <button
          onClick={() => updateSetting("particleSoundEnabled", !settings.particleSoundEnabled)}
          className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.particleSoundEnabled ? "bg-purple-600" : "bg-slate-800"
            }`}
        >
          <div
            className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.particleSoundEnabled ? "translate-x-4" : "translate-x-0"
              }`}
          />
        </button>
      </div>

      {/* ─── GROUP 1: CORE PARTICLE TEXTURE ─── */}
      <div className="flex items-center gap-2 pt-1 border-t border-purple-500/10">
        <span className="text-[9px] font-mono uppercase text-purple-400/90 tracking-wider">
          TACTILE TEXTURE & CLOUD BODY
        </span>
      </div>

      {/* Master Volume */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">MASTER VOLUME</span>
          <span className="text-purple-300">{Math.round((settings.particleSoundVolume ?? 0.60) * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.0"
          max="1.0"
          step="0.02"
          value={settings.particleSoundVolume ?? 0.60}
          onChange={(e) => updateSetting("particleSoundVolume", parseFloat(e.target.value))}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Granular Velvet Dust (Warm Cloud Body) */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">GRANULAR VELVET DUST</span>
          <span className="text-purple-300">{Math.round(dustVol * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.0"
          max="1.0"
          step="0.05"
          value={dustVol}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSetting("particleDustVolume", val);
            particleSoundEngine.updateSettings({ dustVolume: val });
          }}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
          <span>Subtle (0%)</span>
          <span>Rich Velvety Powder (100%)</span>
        </div>
      </div>

      {/* Delicate High-Air Sparkle */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">DELICATE AIR SPARKLE</span>
          <span className="text-purple-300">{Math.round(sparkleInt * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.0"
          max="1.0"
          step="0.05"
          value={sparkleInt}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSetting("particleSparkleIntensity", val);
            particleSoundEngine.updateSettings({ sparkleIntensity: val });
          }}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
          <span>Muted Sheen</span>
          <span>Crystalline Stardust</span>
        </div>
      </div>

      {/* ─── GROUP 2: MICRO-CRACKLE DYNAMICS ─── */}
      <div className="flex items-center gap-2 pt-1 border-t border-purple-500/10">
        <span className="text-[9px] font-mono uppercase text-purple-400/90 tracking-wider">
          TACTILE MICRO-CRACKLES
        </span>
      </div>

      {/* Crackle Density */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">CRACKLE DENSITY (MAX)</span>
          <span className="text-purple-300">{crackleDensity} crackles/sec</span>
        </div>
        <input
          type="range"
          min="20"
          max="350"
          step="10"
          value={crackleDensity}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            updateSetting("particleTickDensity", val);
            particleSoundEngine.updateSettings({ crackleDensity: val });
          }}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Crackle Crispness */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">CRACKLE CRISPNESS</span>
          <span className="text-purple-300">
            {crackleSharpness.toFixed(2)}x{" "}
            <span className="text-purple-400 text-[8.5px]">
              {crackleSharpness < 0.9 ? "(Delicate Grain)" : crackleSharpness < 1.4 ? "(Crisp Static)" : "(Sharp Snap)"}
            </span>
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={crackleSharpness}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSetting("particleTickSharpness", val);
            particleSoundEngine.updateSettings({ crackleSharpness: val });
          }}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* Tail / Decay Release */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">TAIL / SETTLING RELEASE</span>
          <span className="text-purple-300">{(tailTime * 1000).toFixed(0)} ms</span>
        </div>
        <input
          type="range"
          min="0.05"
          max="1.20"
          step="0.02"
          value={tailTime}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSetting("particleAudioTail", val);
            updateSetting("particleRelease", val);
            particleSoundEngine.updateSettings({ tailTime: val, releaseTime: val });
          }}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
        <div className="flex justify-between text-[8px] font-mono text-slate-500 px-0.5">
          <span>Dry Cut (50ms)</span>
          <span>Smooth Floating Dissolve (1200ms)</span>
        </div>
      </div>

      {/* Speed Sensitivity */}
      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between font-mono text-[10px]">
          <span className="text-slate-400">SPEED SENSITIVITY</span>
          <span className="text-purple-300">{speedSens.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.05"
          value={speedSens}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            updateSetting("particleSpeedSensitivity", val);
            updateSetting("particleMotionSensitivity", val);
            particleSoundEngine.updateSettings({ speedSensitivity: val });
          }}
          className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
        />
      </div>

      {/* ─── GROUP 3: LIVE DIAGNOSTIC MONITOR HUD ─── */}
      <div className="pt-1 border-t border-purple-500/10">
        <button
          onClick={() => updateSetting("particleAudioDebug", !showDebug)}
          className="w-full flex items-center justify-between text-[9px] font-mono text-purple-400/90 py-1 hover:text-purple-300 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5 uppercase tracking-wider font-semibold">
            <Activity className="w-3 h-3 text-purple-400" />
            LIVE DIAGNOSTICS & TELEMETRY HUD
          </span>
          {showDebug ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showDebug && (
          <div className="mt-1 p-2 bg-black/60 rounded-lg border border-purple-500/30 flex flex-col gap-1.5 font-mono text-[9px]">
            {/* Energy Bar */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-slate-300">
                <span>SCATTER ENERGY</span>
                <span className="text-purple-300">{(telemetry.energy * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, telemetry.energy * 100)}%` }}
                />
              </div>
            </div>

            {/* SpeedNorm Bar */}
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-slate-300">
                <span>SPEED NORM</span>
                <span className="text-purple-300">{(telemetry.speedNorm * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, telemetry.speedNorm * 100)}%` }}
                />
              </div>
            </div>

            {/* Crackle Rate & Active Voices */}
            <div className="grid grid-cols-2 gap-1 pt-1 text-[8.5px] border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-slate-500">CRACKLES/SEC</span>
                <span className="text-pink-300 font-bold">{telemetry.grainRate}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-slate-500">ACTIVE VOICES</span>
                <span className="text-emerald-300 font-bold">{telemetry.activeVoices}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
