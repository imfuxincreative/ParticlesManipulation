"use client";

import React, { useEffect, useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { useAtmosphere } from "@/lib/atmosphere";
import { AtmospherePanel } from "./atmosphere/AtmospherePanel";
import {
  Sliders,
  Sparkles,
  Camera,
  Menu,
  X,
  Copy,
  Check,
  Upload,
  Trees,
  Sun,
  Navigation,
  RotateCcw,
  Zap
} from "lucide-react";
import Link from "next/link";
import { GHIBLI_PALETTES } from "@/shaders/ghibliShader";

export const Dashboard: React.FC = () => {
  const { settings, updateSetting, updateSettings } = useSimulation();
  const atmoState = useAtmosphere();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"atmosphere" | "visuals" | "particles" | "camera">("atmosphere");
  const [copied, setCopied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise<void>((resolve, reject) => {
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (successful) resolve();
        else reject(new Error("execCommand failed"));
      });
    }
  };

  const handleCopySettings = async () => {
    const rawAtmo = useAtmosphere.getState();
    const cleanAtmo = {
      horizonColor: rawAtmo.horizonColor,
      enableScrollHorizonColor: rawAtmo.enableScrollHorizonColor,
      horizonColorKeyframes: rawAtmo.horizonColorKeyframes,
      zenithColor: rawAtmo.zenithColor,
      glowColor: rawAtmo.glowColor,
      decoupleFog: rawAtmo.decoupleFog,
      fogColorOverride: rawAtmo.fogColorOverride,
      fogEnabled: rawAtmo.fogEnabled,
      fogDensity: rawAtmo.fogDensity,
      fogHeightFalloff: rawAtmo.fogHeightFalloff,
      fogHeightBase: rawAtmo.fogHeightBase,
      skyEnabled: rawAtmo.skyEnabled,
      skyExposure: rawAtmo.skyExposure,
      glowStrength: rawAtmo.glowStrength,
      glowMode: rawAtmo.glowMode,
      glowDirection: rawAtmo.glowDirection,
      cloudScale: rawAtmo.cloudScale,
      cloudSpeed: rawAtmo.cloudSpeed,
      cloudContrast: rawAtmo.cloudContrast,
      cloudCoverage: rawAtmo.cloudCoverage,
      ambientIntensity: rawAtmo.ambientIntensity,
      rimIntensity: rawAtmo.rimIntensity,
      rimWhiteMix: rawAtmo.rimWhiteMix,
      keyFillIntensity: rawAtmo.keyFillIntensity,
      topGlowIntensity: rawAtmo.topGlowIntensity,
      rimPositionOffset: rawAtmo.rimPositionOffset,
      keyFillPositionOffset: rawAtmo.keyFillPositionOffset,
      bloomIntensity: rawAtmo.bloomIntensity,
      bloomThreshold: rawAtmo.bloomThreshold,
      bloomRadius: rawAtmo.bloomRadius,
      vignetteStrength: rawAtmo.vignetteStrength,
      vignetteOffset: rawAtmo.vignetteOffset,
      grainAmount: rawAtmo.grainAmount,
      godRays: rawAtmo.godRays,
      quality: rawAtmo.quality,
      brokenLightEnabled: rawAtmo.brokenLightEnabled,
      brokenLightIntensity: rawAtmo.brokenLightIntensity,
      brokenLightSpeed: rawAtmo.brokenLightSpeed,
      brokenLightSurge: rawAtmo.brokenLightSurge,
      brokenLightScope: rawAtmo.brokenLightScope,
      brokenLightStyle: rawAtmo.brokenLightStyle,
    };

    const { atmosphere: _pollutedAtmo, ...cleanSimSettings } = settings as any;

    const exportData = {
      ...cleanSimSettings,
      atmosphere: cleanAtmo,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    try {
      await copyToClipboard(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImportSettings = () => {
    try {
      const parsed = JSON.parse(importText);
      if (typeof parsed !== "object" || parsed === null) {
        setImportStatus("Invalid JSON structure.");
        return;
      }

      if (parsed.atmosphere && typeof parsed.atmosphere === "object") {
        atmoState.applyPreset(parsed.atmosphere);
      } else if (parsed.horizonColor || parsed.fogDensity || parsed.skyExposure) {
        atmoState.applyPreset(parsed);
      }

      const { atmosphere: _atmo, set: _set, applyPreset: _applyPreset, ...simSettings } = parsed;
      updateSettings(simSettings);

      setImportStatus("Settings applied successfully!");
      setTimeout(() => {
        setImportStatus(null);
        setShowImportModal(false);
        setImportText("");
      }, 1200);
    } catch {
      setImportStatus("Failed to parse JSON. Please check formatting.");
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none select-none z-20 font-sans text-slate-100 flex flex-col justify-between p-6">

      {/* Quick Access Top Bar */}
      <div className="fixed top-6 left-6 z-40 pointer-events-auto flex items-center gap-3">
        <Link
          href="/ghibli-grass"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-500/50 backdrop-blur-md text-emerald-200 hover:text-white text-xs font-semibold tracking-wide transition-all shadow-lg hover:shadow-emerald-900/40"
        >
          <Trees className="w-4 h-4 text-emerald-400" />
          <span>Ghibli Grass Studio</span>
        </Link>
      </div>

      {/* Burger Menu Toggle */}
      <div className="fixed top-6 right-6 z-40 pointer-events-auto">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-10 h-10 rounded-xl bg-slate-900/80 border border-white/15 backdrop-blur-md flex items-center justify-center text-slate-200 hover:text-white hover:bg-slate-800 transition-all shadow-lg cursor-pointer"
          aria-label="Toggle Menu"
        >
          {isCollapsed ? <Menu className="w-5 h-5 text-slate-200" /> : <X className="w-5 h-5 text-slate-200" />}
        </button>
      </div>

      {/* Main HUD Controls Sidebar */}
      <main className="absolute right-4 md:right-6 top-20 md:top-24 bottom-20 md:bottom-24 flex items-stretch pointer-events-none z-30">
        <div
          data-lenis-prevent
          onWheel={(e) => e.stopPropagation()}
          className={`bg-slate-950/85 backdrop-blur-xl border border-white/10 rounded-2xl w-72 md:w-80 p-5 flex flex-col gap-4 transition-all duration-300 overflow-y-auto overscroll-contain ${isCollapsed ? "opacity-0 w-0 pointer-events-none translate-x-8" : "opacity-100 pointer-events-auto"
            }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Crimson Scene Controls
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="grid grid-cols-4 gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5 text-[9px] font-medium text-slate-400">
            <button
              onClick={() => setActiveTab("atmosphere")}
              className={`py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-0.5 ${activeTab === "atmosphere" ? "bg-red-700 text-white font-semibold shadow" : "hover:text-slate-200"
                }`}
            >
              <Sun className="w-3 h-3" />
              <span>Atmo</span>
            </button>
            <button
              onClick={() => setActiveTab("visuals")}
              className={`py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-0.5 ${activeTab === "visuals" ? "bg-emerald-600 text-white font-semibold shadow" : "hover:text-slate-200"
                }`}
            >
              <Trees className="w-3 h-3" />
              <span>Visuals</span>
            </button>
            <button
              onClick={() => setActiveTab("particles")}
              className={`py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-0.5 ${activeTab === "particles" ? "bg-purple-600 text-white font-semibold shadow" : "hover:text-slate-200"
                }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Particles</span>
            </button>
            <button
              onClick={() => setActiveTab("camera")}
              className={`py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-0.5 ${activeTab === "camera" ? "bg-emerald-600 text-white font-semibold shadow" : "hover:text-slate-200"
                }`}
            >
              <Camera className="w-3 h-3" />
              <span>Camera</span>
            </button>
          </div>

          {/* Copy & Import Settings */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopySettings}
              className="py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-300 text-[11px]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="text-[11px]">Copy JSON</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setShowImportModal(true);
                setImportStatus(null);
              }}
              className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">Import JSON</span>
            </button>
          </div>

          {/* Import JSON Modal */}
          {showImportModal && (
            <div
              data-lenis-prevent
              onWheel={(e) => e.stopPropagation()}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 pointer-events-auto overscroll-contain"
            >
              <div className="bg-slate-900 border border-emerald-500/40 rounded-xl w-full max-w-lg p-5 flex flex-col gap-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold">
                    <Upload className="w-4 h-4" />
                    <span>Import Settings (JSON)</span>
                  </div>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste JSON settings string here..."
                  className="w-full h-48 bg-slate-950 border border-white/10 rounded-lg p-3 font-mono text-xs text-emerald-200 focus:outline-none focus:border-emerald-500 resize-none"
                />

                {importStatus && (
                  <div
                    className={`text-xs p-2 rounded border font-mono ${importStatus.includes("successfully")
                      ? "bg-green-950/50 border-green-500/50 text-green-300"
                      : "bg-red-950/50 border-red-500/50 text-red-300"
                      }`}
                  >
                    {importStatus}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImportSettings}
                    disabled={!importText.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition-all shadow-md"
                  >
                    Apply Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: ATMOSPHERE CONTROL PANEL */}
          {activeTab === "atmosphere" && <AtmospherePanel />}

          {/* TAB 2: VISUALS & GHIBLI GRASS */}
          {activeTab === "visuals" && (
            <div className="flex flex-col gap-4 text-xs">
              {/* GHIBLI GRASS & FOLIAGE */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
                  <Trees className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ghibli Grass & Foliage</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">SHOW GHIBLI GRASS</span>
                  <button
                    onClick={() => updateSetting("showGhibliGrass", !settings.showGhibliGrass)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGhibliGrass ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.showGhibliGrass ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">REALISTIC MEADOW SHADING</span>
                  <button
                    onClick={() => updateSetting("useRealisticGrass", !settings.useRealisticGrass)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.useRealisticGrass ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.useRealisticGrass ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GRASS DENSITY / COUNT</span>
                    <span className="text-emerald-300">{(settings.ghibliGrassCount / 1000).toFixed(0)}k</span>
                  </div>
                  <input
                    type="range"
                    min="50000"
                    max="1000000"
                    step="10000"
                    value={settings.ghibliGrassCount}
                    onChange={(e) => updateSetting("ghibliGrassCount", parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GRASS HEIGHT</span>
                    <span className="text-emerald-300">{settings.ghibliGrassHeight.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4.0"
                    step="0.1"
                    value={settings.ghibliGrassHeight}
                    onChange={(e) => updateSetting("ghibliGrassHeight", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GRASS WIDTH</span>
                    <span className="text-emerald-300">{settings.ghibliGrassWidth.toFixed(2)}u</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={settings.ghibliGrassWidth}
                    onChange={(e) => updateSetting("ghibliGrassWidth", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FIELD RADIUS</span>
                    <span className="text-emerald-300">{settings.ghibliGrassRadius}u</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={settings.ghibliGrassRadius}
                    onChange={(e) => updateSetting("ghibliGrassRadius", parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">WIND SPEED</span>
                    <span className="text-emerald-300">{settings.ghibliGrassWindSpeed.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={settings.ghibliGrassWindSpeed}
                    onChange={(e) => updateSetting("ghibliGrassWindSpeed", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">WIND STRENGTH</span>
                    <span className="text-emerald-300">{settings.ghibliGrassWindStrength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="1.5"
                    step="0.05"
                    value={settings.ghibliGrassWindStrength}
                    onChange={(e) => updateSetting("ghibliGrassWindStrength", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">REVEAL DISTANCE</span>
                    <span className="text-emerald-300">{settings.ghibliGrassRevealDistance}u</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1500"
                    step="10"
                    value={settings.ghibliGrassRevealDistance}
                    onChange={(e) => updateSetting("ghibliGrassRevealDistance", parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">REVEAL SOFTNESS</span>
                    <span className="text-emerald-300">{settings.ghibliGrassRevealSoftness}u</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="300"
                    step="5"
                    value={settings.ghibliGrassRevealSoftness}
                    onChange={(e) => updateSetting("ghibliGrassRevealSoftness", parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">REVEAL OFFSET</span>
                    <span className="text-emerald-300">{settings.ghibliGrassRevealOffset}u</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="200"
                    step="5"
                    value={settings.ghibliGrassRevealOffset}
                    onChange={(e) => updateSetting("ghibliGrassRevealOffset", parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* MEADOW FLOWERS */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Meadow Flowers</span>
                  </div>
                  <button
                    onClick={() => updateSetting("showGhibliFlowers", !settings.showGhibliFlowers)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGhibliFlowers ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.showGhibliFlowers ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLOWER COUNT</span>
                    <span className="text-emerald-300">{(settings.ghibliFlowerCount / 1000).toFixed(0)}k</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="1000"
                    value={settings.ghibliFlowerCount}
                    onChange={(e) => updateSetting("ghibliFlowerCount", parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLOWER SCALE</span>
                    <span className="text-emerald-300">{settings.ghibliFlowerScale.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={settings.ghibliFlowerScale}
                    onChange={(e) => updateSetting("ghibliFlowerScale", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* TREES & COLOR PALETTE */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">SHOW GHIBLI TREES</span>
                  <button
                    onClick={() => updateSetting("showGhibliTrees", !settings.showGhibliTrees)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGhibliTrees ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.showGhibliTrees ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Color Palette</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(Object.keys(GHIBLI_PALETTES) as Array<keyof typeof GHIBLI_PALETTES>).map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          updateSetting("ghibliPaletteKey", key);
                          const pal = GHIBLI_PALETTES[key];
                          if (pal && pal.ground) {
                            updateSetting("groundColor", pal.ground);
                          }
                        }}
                        className={`py-1 rounded border text-center font-mono capitalize cursor-pointer transition-all text-[10px] ${settings.ghibliPaletteKey === key
                          ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold"
                          : "bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* GROUND PLANE */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-mono text-[10px]">GROUND COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden"
                      style={{ backgroundColor: settings.groundColor }}
                    >
                      <input
                        type="color"
                        value={settings.groundColor}
                        onChange={(e) => updateSetting("groundColor", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">{settings.groundColor}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GROUND OPACITY</span>
                    <span className="text-emerald-300">{(settings.groundOpacity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.groundOpacity}
                    onChange={(e) => updateSetting("groundOpacity", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* CHARACTER GLOW & BLOOM */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Character Glow & Bloom</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">CHARACTER GLOW INTENSITY</span>
                    <span className="text-emerald-300">{settings.simonGlowIntensity.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="5.0"
                    step="0.1"
                    value={settings.simonGlowIntensity}
                    onChange={(e) => updateSetting("simonGlowIntensity", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">CHARACTER BLOOM INTENSITY</span>
                    <span className="text-emerald-300">{settings.simonBloomIntensity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={settings.simonBloomIntensity}
                    onChange={(e) => updateSetting("simonBloomIntensity", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">GLOW COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden"
                      style={{ backgroundColor: settings.simonGlowColor }}
                    >
                      <input
                        type="color"
                        value={settings.simonGlowColor}
                        onChange={(e) => updateSetting("simonGlowColor", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">{settings.simonGlowColor}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GLOW OPACITY</span>
                    <span className="text-emerald-300">{(settings.simonGlowOpacity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.simonGlowOpacity}
                    onChange={(e) => updateSetting("simonGlowOpacity", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* FLYING CARS TRAFFIC */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-emerald-400 tracking-wider">
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Flying Cars Traffic</span>
                  </div>
                  <button
                    onClick={() => updateSetting("enableFlyingCars", !settings.enableFlyingCars)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.enableFlyingCars ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.enableFlyingCars ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">BASE FLIGHT SPEED</span>
                    <span className="text-emerald-300">{(settings.flyingCarsBaseSpeed ?? 35).toFixed(0)} u/s</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="1"
                    value={settings.flyingCarsBaseSpeed ?? 35}
                    onChange={(e) => updateSetting("flyingCarsBaseSpeed", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">SPEED VARIANCE (RANDOM FAIR)</span>
                    <span className="text-emerald-300">±{((settings.flyingCarsSpeedVariance ?? 0.35) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.8"
                    step="0.05"
                    value={settings.flyingCarsSpeedVariance ?? 0.35}
                    onChange={(e) => updateSetting("flyingCarsSpeedVariance", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">LOOP DISTANCE (SCREEN WRAP SPAN)</span>
                    <span className="text-emerald-300">{(settings.flyingCarsMaxDistance ?? 800).toFixed(0)}u</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="2500"
                    step="50"
                    value={settings.flyingCarsMaxDistance ?? 800}
                    onChange={(e) => updateSetting("flyingCarsMaxDistance", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">INVERT FLIGHT DIRECTION</span>
                  <button
                    onClick={() => updateSetting("invertFlyingCarsDirection", !settings.invertFlyingCarsDirection)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.invertFlyingCarsDirection ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.invertFlyingCarsDirection ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">HOVER BOBBING (FLOATING)</span>
                  <button
                    onClick={() => updateSetting("flyingCarsHoverBobbing", !settings.flyingCarsHoverBobbing)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.flyingCarsHoverBobbing ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.flyingCarsHoverBobbing ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>

                {settings.flyingCarsHoverBobbing && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-slate-400">BOBBING STRENGTH</span>
                      <span className="text-emerald-300">{(settings.flyingCarsBobbingStrength ?? 0.8).toFixed(1)}u</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={settings.flyingCarsBobbingStrength ?? 0.8}
                      onChange={(e) => updateSetting("flyingCarsBobbingStrength", parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                <button
                  onClick={() => {
                    if (typeof (window as any).__resetFlyingCars === "function") {
                      (window as any).__resetFlyingCars();
                    }
                  }}
                  className="mt-1 py-1 px-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded text-[10px] text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all cursor-pointer font-mono"
                >
                  <RotateCcw className="w-3 h-3 text-emerald-400" />
                  <span>Reset Car Positions</span>
                </button>
              </div>

              {/* FLYING CAR LED LIGHTS */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-cyan-400 tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Flying Car LED Lights</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                    GLOW SHADER
                  </span>
                </div>

                {/* Intensity Slider */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">LED LIGHT INTENSITY</span>
                    <span className="text-cyan-300">{(settings.carLedIntensity ?? 3.5).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="10.0"
                    step="0.1"
                    value={settings.carLedIntensity ?? 3.5}
                    onChange={(e) => updateSetting("carLedIntensity", parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Light Color Picker */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">LIGHT COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden shadow-sm"
                      style={{ backgroundColor: settings.carLedColor ?? "#00f0ff" }}
                    >
                      <input
                        type="color"
                        value={settings.carLedColor ?? "#00f0ff"}
                        onChange={(e) => updateSetting("carLedColor", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">
                      {settings.carLedColor ?? "#00f0ff"}
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-col gap-1 pt-0.5">
                  <span className="text-slate-400 font-mono text-[9px]">COLOR PRESETS</span>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      { name: "Cyan", color: "#00f0ff" },
                      { name: "Red", color: "#ff2a4d" },
                      { name: "Amber", color: "#ffb700" },
                      { name: "White", color: "#e2f1ff" },
                      { name: "Violet", color: "#c084fc" },
                      { name: "Emerald", color: "#10b981" },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        title={preset.name}
                        onClick={() => updateSetting("carLedColor", preset.color)}
                        className={`h-5 rounded border transition-all cursor-pointer flex items-center justify-center ${
                          (settings.carLedColor ?? "#00f0ff").toLowerCase() === preset.color.toLowerCase()
                            ? "border-white scale-105 shadow-md shadow-cyan-500/30"
                            : "border-white/10 hover:border-white/40"
                        }`}
                        style={{ backgroundColor: preset.color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Pulse / Shimmer Toggle */}
                <div className="flex justify-between items-center py-0.5 border-t border-white/5 pt-1.5 mt-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">BEACON PULSE / SHIMMER</span>
                  <button
                    onClick={() => updateSetting("carLedPulse", settings.carLedPulse === false ? true : false)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${
                      settings.carLedPulse !== false ? "bg-cyan-600" : "bg-slate-800"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${
                        settings.carLedPulse !== false ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {settings.carLedPulse !== false && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="text-slate-400">PULSE SPEED</span>
                      <span className="text-cyan-300">{(settings.carLedPulseSpeed ?? 2.5).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="8.0"
                      step="0.5"
                      value={settings.carLedPulseSpeed ?? 2.5}
                      onChange={(e) => updateSetting("carLedPulseSpeed", parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PARTICLE EFFECT CONTROLS */}
          {activeTab === "particles" && (
            <div className="flex flex-col gap-4 text-xs">
              {/* 1. MODEL MORPH & CORE PARTICLES */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Particle Model & Appearance</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">3D MODEL SELECTION</span>
                  <div className="flex gap-1">
                    {["Heart", "Bird"].map((name, idx) => (
                      <button
                        key={name}
                        onClick={() => updateSetting("currentModelIndex", idx)}
                        className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition-all ${(settings.currentModelIndex ?? 0) === idx
                            ? "bg-purple-600 text-white font-bold"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">PARTICLE SIZE</span>
                    <span className="text-purple-300">{(settings.pointSize ?? 2.5).toFixed(1)}px</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.1"
                    value={settings.pointSize ?? 2.5}
                    onChange={(e) => updateSetting("pointSize", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">DEFAULT PARTICLE COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden"
                      style={{ backgroundColor: settings.particleDefaultColor || "#ffffff" }}
                    >
                      <input
                        type="color"
                        value={settings.particleDefaultColor || "#ffffff"}
                        onChange={(e) => updateSetting("particleDefaultColor", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">{settings.particleDefaultColor || "#ffffff"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">PARTICLE OPACITY</span>
                    <span className="text-purple-300">{((settings.opacity ?? 1.0) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.opacity ?? 1.0}
                    onChange={(e) => updateSetting("opacity", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">MODEL SCALE</span>
                    <span className="text-purple-300">{(settings.modelScale ?? 1.0).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={settings.modelScale ?? 1.0}
                    onChange={(e) => updateSetting("modelScale", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">MORPH SPEED</span>
                    <span className="text-purple-300">{(settings.loaderMorphSpeed ?? 0.06).toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.005"
                    max="0.1"
                    step="0.005"
                    value={settings.loaderMorphSpeed ?? 0.06}
                    onChange={(e) => updateSetting("loaderMorphSpeed", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">AUTO ROTATION SPEED</span>
                    <span className="text-purple-300">{(settings.modelAutoRotateSpeedX ?? 0.3).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-2.0"
                    max="2.0"
                    step="0.05"
                    value={settings.modelAutoRotateSpeedX ?? 0.3}
                    onChange={(e) => updateSetting("modelAutoRotateSpeedX", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. FLOW & TURBULENCE DYNAMICS */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Flow & Turbulence Dynamics</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLOW STRENGTH</span>
                    <span className="text-purple-300">{(settings.modelFlowStrength ?? 0.4).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.05"
                    value={settings.modelFlowStrength ?? 0.4}
                    onChange={(e) => updateSetting("modelFlowStrength", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLOW SPEED</span>
                    <span className="text-purple-300">{(settings.modelFlowSpeed ?? 0.15).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.01"
                    value={settings.modelFlowSpeed ?? 0.15}
                    onChange={(e) => updateSetting("modelFlowSpeed", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLOW FREQUENCY</span>
                    <span className="text-purple-300">{(settings.modelFlowFrequency ?? 0.72).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.05"
                    value={settings.modelFlowFrequency ?? 0.72}
                    onChange={(e) => updateSetting("modelFlowFrequency", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLOW CLUMPING</span>
                    <span className="text-purple-300">{(settings.modelFlowClumping ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.modelFlowClumping ?? 0}
                    onChange={(e) => updateSetting("modelFlowClumping", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">SCATTER COLOR SCALE</span>
                    <span className="text-purple-300">{(settings.modelScatterColorScale ?? 0.04).toFixed(3)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.5"
                    step="0.005"
                    value={settings.modelScatterColorScale ?? 0.04}
                    onChange={(e) => updateSetting("modelScatterColorScale", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 3. FLUID & INTERACTION PHYSICS */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Fluid Interaction Physics</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLUID DRAG RADIUS</span>
                    <span className="text-purple-300">{(settings.fluidDragRadius ?? 4.0).toFixed(1)}u</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="15.0"
                    step="0.5"
                    value={settings.fluidDragRadius ?? 4.0}
                    onChange={(e) => updateSetting("fluidDragRadius", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLUID DRAG STRENGTH</span>
                    <span className="text-purple-300">{(settings.fluidDragStrength ?? 1.2).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={settings.fluidDragStrength ?? 1.2}
                    onChange={(e) => updateSetting("fluidDragStrength", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FLUID DAMPING</span>
                    <span className="text-purple-300">{(settings.fluidDamping ?? 0.88).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.99"
                    step="0.01"
                    value={settings.fluidDamping ?? 0.88}
                    onChange={(e) => updateSetting("fluidDamping", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">RADIAL EXPANSION</span>
                    <span className="text-purple-300">{(settings.fluidRadialExpansion ?? 0.45).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={settings.fluidRadialExpansion ?? 0.45}
                    onChange={(e) => updateSetting("fluidRadialExpansion", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">TURBULENCE SWIRL</span>
                    <span className="text-purple-300">{(settings.fluidTurbulenceSwirl ?? 0.35).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={settings.fluidTurbulenceSwirl ?? 0.35}
                    onChange={(e) => updateSetting("fluidTurbulenceSwirl", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">DIRECTIONAL DRAG BIAS</span>
                    <span className="text-purple-300">{(settings.fluidDirectionalBias ?? 0.4).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={settings.fluidDirectionalBias ?? 0.4}
                    onChange={(e) => updateSetting("fluidDirectionalBias", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 4. BURN SHADER & COLOR GLOW */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Particle Burn Shading</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">BURN PRIMARY COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden"
                      style={{ backgroundColor: settings.burnColorPrimary || "#e91e63" }}
                    >
                      <input
                        type="color"
                        value={settings.burnColorPrimary || "#e91e63"}
                        onChange={(e) => updateSetting("burnColorPrimary", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">{settings.burnColorPrimary || "#e91e63"}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">BURN SECONDARY COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden"
                      style={{ backgroundColor: settings.burnColorSecondary || "#00ffff" }}
                    >
                      <input
                        type="color"
                        value={settings.burnColorSecondary || "#00ffff"}
                        onChange={(e) => updateSetting("burnColorSecondary", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">{settings.burnColorSecondary || "#00ffff"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">BURN SENSITIVITY</span>
                    <span className="text-purple-300">{(settings.burnSensitivity ?? 2.5).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={settings.burnSensitivity ?? 2.5}
                    onChange={(e) => updateSetting("burnSensitivity", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">BURN THRESHOLD</span>
                    <span className="text-purple-300">{(settings.burnThreshold ?? 0.05).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.01"
                    value={settings.burnThreshold ?? 0.05}
                    onChange={(e) => updateSetting("burnThreshold", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">BURN EXPONENT</span>
                    <span className="text-purple-300">{(settings.burnExponent ?? 1.5).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={settings.burnExponent ?? 1.5}
                    onChange={(e) => updateSetting("burnExponent", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 5. NOISE & OPTICS / TINT / HAZE */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Noise & Optics</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">NOISE STRENGTH</span>
                    <span className="text-purple-300">{(settings.noiseStrength ?? 0.1).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.01"
                    value={settings.noiseStrength ?? 0.1}
                    onChange={(e) => updateSetting("noiseStrength", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">NOISE SPEED</span>
                    <span className="text-purple-300">{(settings.noiseSpeed ?? 0.4).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={settings.noiseSpeed ?? 0.4}
                    onChange={(e) => updateSetting("noiseSpeed", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">TINT COLOR</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded border border-white/20 relative overflow-hidden"
                      style={{ backgroundColor: settings.tintColor || "#a855f7" }}
                    >
                      <input
                        type="color"
                        value={settings.tintColor || "#a855f7"}
                        onChange={(e) => updateSetting("tintColor", e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-[10px] text-slate-300 font-mono w-14">{settings.tintColor || "#a855f7"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">TINT MIX</span>
                    <span className="text-purple-300">{((settings.tintMix ?? 0) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.tintMix ?? 0}
                    onChange={(e) => updateSetting("tintMix", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 6. PARTICLE GLITCH EFFECTS */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-purple-400 tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Glitch Effects</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">PARTICLE GLITCH INTENSITY</span>
                    <span className="text-purple-300">{(settings.glitchIntensity ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.glitchIntensity ?? 0}
                    onChange={(e) => updateSetting("glitchIntensity", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">BG GLITCH INTENSITY</span>
                    <span className="text-purple-300">{(settings.bgGlitchIntensity ?? 0).toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.bgGlitchIntensity ?? 0}
                    onChange={(e) => updateSetting("bgGlitchIntensity", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 7. LOADER SYSTEM */}
              <div className="flex flex-col gap-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400 font-mono text-[10px]">ALWAYS SHOW LOADER</span>
                  <button
                    onClick={() => updateSetting("alwaysShowLoader", !settings.alwaysShowLoader)}
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.alwaysShowLoader ? "bg-purple-600" : "bg-slate-800"
                      }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${settings.alwaysShowLoader ? "translate-x-4" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAMERA & SCROLL */}
          {activeTab === "camera" && (
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-400 tracking-wider mb-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Scroll & Glide</span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">SCROLL SPEED</span>
                  <span className="text-emerald-300">{settings.scrollSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={settings.scrollSpeed}
                  onChange={(e) => updateSetting("scrollSpeed", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">SCROLL DAMPING</span>
                  <span className="text-emerald-300">{settings.scrollDamping.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1.0"
                  step="0.01"
                  value={settings.scrollDamping}
                  onChange={(e) => updateSetting("scrollDamping", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">ENABLE SCROLL SNAPPING</span>
                <button
                  onClick={() => updateSetting("enableScrollSnap", !settings.enableScrollSnap)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.enableScrollSnap ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.enableScrollSnap ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <GrassDebugBadge />
    </div>
  );
};

const GrassDebugBadge: React.FC = () => {
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    let animId: number;
    const update = () => {
      if (typeof window !== "undefined" && (window as any)._grassDebugData) {
        setData({ ...(window as any)._grassDebugData });
      }
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  if (!data) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 pointer-events-none bg-slate-950/90 backdrop-blur-md border border-emerald-500/40 rounded-xl p-3.5 text-[11px] font-mono text-emerald-300 shadow-2xl flex flex-col gap-1 max-w-xs">
      <div className="font-bold text-emerald-400 border-b border-white/10 pb-1 mb-1">
        🔍 GRASS REVEAL PIPELINE DEBUGGER
      </div>
      <div>Cam Pos: [{data.camPos.join(", ")}]</div>
      <div>Cam Dir: [{data.camDir.join(", ")}]</div>
      <div>Scroll Ratio: {((parseFloat(data.scrollRatio) || 0) * 100).toFixed(1)}% ({data.scrollRatio})</div>
      <div>Reveal Progress: {((parseFloat(data.revealProgress) || 0) * 100).toFixed(1)}% ({data.revealProgress})</div>
      <div>Reveal Offset: {data.revealOffset}u</div>
      <div>Reveal Distance: {data.revealDistance}u</div>
      <div className="text-yellow-300 font-bold">WaveFront Ahead: +{data.waveFront}u</div>
    </div>
  );
};
