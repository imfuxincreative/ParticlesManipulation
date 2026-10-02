"use client";

import React, { useEffect, useState } from "react";
import { useSimulation } from "@/context/SimulationContext";
import {
  Sliders,
  Sparkles,
  Camera,
  Menu,
  X,
  Copy,
  Check,
  Upload,
  Trees
} from "lucide-react";
import Link from "next/link";
import { GHIBLI_PALETTES } from "@/shaders/ghibliShader";

export const Dashboard: React.FC = () => {
  const { settings, updateSetting, updateSettings } = useSimulation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"visuals" | "camera">("visuals");
  const [copied, setCopied] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleCopySettings = () => {
    const jsonString = JSON.stringify(settings, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonString).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = jsonString;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
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
      updateSettings(parsed);
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
          className={`bg-slate-950/85 backdrop-blur-xl border border-white/10 rounded-2xl w-72 md:w-80 p-5 flex flex-col gap-4 transition-all duration-300 overflow-y-auto ${isCollapsed ? "opacity-0 w-0 pointer-events-none translate-x-8" : "opacity-100 pointer-events-auto"
            }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-bold tracking-wider uppercase text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" /> Anime Scene Controls
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="grid grid-cols-2 gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5 text-xs font-medium text-slate-400">
            <button
              onClick={() => setActiveTab("visuals")}
              className={`py-1.5 rounded-lg cursor-pointer transition-all ${activeTab === "visuals" ? "bg-emerald-600 text-white font-semibold shadow" : "hover:text-slate-200"
                }`}
            >
              Visuals & Grass
            </button>
            <button
              onClick={() => setActiveTab("camera")}
              className={`py-1.5 rounded-lg cursor-pointer transition-all ${activeTab === "camera" ? "bg-emerald-600 text-white font-semibold shadow" : "hover:text-slate-200"
                }`}
            >
              Camera & Fog
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
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 pointer-events-auto">
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

          {/* TAB 1: VISUALS & GHIBLI GRASS */}
          {activeTab === "visuals" && (
            <div className="flex flex-col gap-4 text-xs">
              {/* GHIBLI GRASS & FOLIAGE */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-400 tracking-wider mb-1">
                <Trees className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ghibli Grass & Foliage</span>
              </div>

              {/* Toggle: Show Ghibli Grass */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">SHOW GHIBLI GRASS</span>
                <button
                  onClick={() => updateSetting("showGhibliGrass", !settings.showGhibliGrass)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGhibliGrass ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showGhibliGrass ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Toggle: Realistic vs Ghibli Shading */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">REALISTIC MEADOW SHADING</span>
                <button
                  onClick={() => updateSetting("useRealisticGrass", !settings.useRealisticGrass)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.useRealisticGrass ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.useRealisticGrass ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Toggle: Show Meadow Flowers */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">SHOW MEADOW FLOWERS</span>
                <button
                  onClick={() => updateSetting("showGhibliFlowers", !settings.showGhibliFlowers)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGhibliFlowers ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showGhibliFlowers ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Toggle: Show Ghibli Trees */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">SHOW GHIBLI TREES</span>
                <button
                  onClick={() => updateSetting("showGhibliTrees", !settings.showGhibliTrees)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGhibliTrees ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showGhibliTrees ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider: Meadow Flower Density */}
              {settings.showGhibliFlowers && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">MEADOW FLOWER DENSITY</span>
                    <span className="text-pink-300">{(settings.ghibliFlowerCount ?? 12000).toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="50000"
                    step="1000"
                    value={settings.ghibliFlowerCount ?? 12000}
                    onChange={(e) => updateSetting("ghibliFlowerCount", parseInt(e.target.value))}
                    className="w-full accent-pink-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Meadow Flower Scale */}
              {settings.showGhibliFlowers && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">MEADOW FLOWER SCALE</span>
                    <span className="text-pink-300">{(settings.ghibliFlowerScale ?? 1.2).toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="3.5"
                    step="0.1"
                    value={settings.ghibliFlowerScale ?? 1.2}
                    onChange={(e) => updateSetting("ghibliFlowerScale", parseFloat(e.target.value))}
                    className="w-full accent-pink-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grass Blade Count */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">GRASS BLADE DENSITY</span>
                  <span className="text-emerald-300">{(settings.ghibliGrassCount ?? 500000).toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="500000"
                  max="2000000"
                  step="25000"
                  value={settings.ghibliGrassCount ?? 500000}
                  onChange={(e) => updateSetting("ghibliGrassCount", parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Grass Blade Height (Length) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">GRASS HEIGHT (LENGTH)</span>
                  <span className="text-emerald-300">{(settings.ghibliGrassHeight ?? 1.7).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="6.0"
                  step="0.1"
                  value={settings.ghibliGrassHeight ?? 1.7}
                  onChange={(e) => updateSetting("ghibliGrassHeight", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Grass Blade Thickness (Width) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">GRASS THICKNESS (WIDTH)</span>
                  <span className="text-emerald-300">{(settings.ghibliGrassWidth ?? 0.3).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="6.0"
                  step="0.1"
                  value={settings.ghibliGrassWidth ?? 0.3}
                  onChange={(e) => updateSetting("ghibliGrassWidth", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Grass Wind Speed */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">GRASS WIND SPEED</span>
                  <span className="text-emerald-300">{(settings.ghibliGrassWindSpeed ?? 1.2).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.1"
                  value={settings.ghibliGrassWindSpeed ?? 1.2}
                  onChange={(e) => updateSetting("ghibliGrassWindSpeed", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Grass Reveal Distance */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">REVEAL WAVE DISTANCE</span>
                  <span className="text-emerald-300">{(settings.ghibliGrassRevealDistance ?? 710).toFixed(0)}u</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1200"
                  step="20"
                  value={settings.ghibliGrassRevealDistance ?? 710}
                  onChange={(e) => updateSetting("ghibliGrassRevealDistance", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Grass Reveal Softness */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">REVEAL WAVE SOFTNESS</span>
                  <span className="text-slate-300">{(settings.ghibliGrassRevealSoftness ?? 100).toFixed(0)}u</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  step="5"
                  value={settings.ghibliGrassRevealSoftness ?? 100}
                  onChange={(e) => updateSetting("ghibliGrassRevealSoftness", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Grass Reveal Offset */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">REVEAL START OFFSET</span>
                  <span className="text-slate-300">{(settings.ghibliGrassRevealOffset ?? 0).toFixed(0)}u</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="600"
                  step="10"
                  value={settings.ghibliGrassRevealOffset ?? 0}
                  onChange={(e) => updateSetting("ghibliGrassRevealOffset", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Palette Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider">Color Palette</span>
                <div className="grid grid-cols-3 gap-1">
                  {(["realistic", "summer", "sunset", "sakura", "autumn", "night"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        updateSetting("ghibliPaletteKey", key);
                        const pal = GHIBLI_PALETTES[key as keyof typeof GHIBLI_PALETTES];
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

              {/* Ground Plane Controls */}
              <div className="flex flex-col gap-1.5 mt-2 p-2.5 bg-slate-900/60 border border-white/5 rounded-xl">
                <span className="text-[10px] uppercase text-emerald-400 font-semibold tracking-wider">Ground Plane Controls</span>
                
                {/* Slider: Ground Plane Opacity */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GROUND PLANE OPACITY</span>
                    <span className="text-emerald-300">{((settings.groundOpacity ?? 1.0) * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={settings.groundOpacity ?? 1.0}
                    onChange={(e) => updateSetting("groundOpacity", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Color: Ground Plane Color */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">GROUND BASE COLOR</span>
                    <span className="text-emerald-300">{settings.groundColor || "#1c3d18"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.groundColor || "#1c3d18"}
                      onChange={(e) => updateSetting("groundColor", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">Select ground color</span>
                  </div>
                </div>
              </div>

              {/* CHARACTER GLOW & BLOOM */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-400 tracking-wider mt-4 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Character Glow & Bloom</span>
              </div>

              {/* Slider: Simon Glow Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">GLOW INTENSITY</span>
                  <span className="text-emerald-300">{(settings.simonGlowIntensity ?? 1.2).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
                  step="0.1"
                  value={settings.simonGlowIntensity ?? 1.2}
                  onChange={(e) => updateSetting("simonGlowIntensity", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Outfit Base Opacity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">OUTFIT BASE OPACITY</span>
                  <span className="text-emerald-300">{((settings.simonGlowOpacity ?? 0.4) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={settings.simonGlowOpacity ?? 0.4}
                  onChange={(e) => updateSetting("simonGlowOpacity", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Bloom Strength */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">BLOOM STRENGTH</span>
                  <span className="text-emerald-300">{(settings.simonBloomIntensity ?? 0.4).toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="3.0"
                  step="0.05"
                  value={settings.simonBloomIntensity ?? 0.4}
                  onChange={(e) => updateSetting("simonBloomIntensity", parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Color: Glow Color */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-400">GLOW COLOR</span>
                  <span className="text-emerald-300">{settings.simonGlowColor || "#ffffff"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.simonGlowColor || "#ffffff"}
                    onChange={(e) => updateSetting("simonGlowColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">Select glow color</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAMERA & FOG */}
          {activeTab === "camera" && (
            <div className="flex flex-col gap-4 text-xs">
              {/* SCROLL CONTROLS */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-400 tracking-wider mb-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Scroll & Glide</span>
              </div>

              {/* Slider: Scroll Speed */}
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

              {/* Slider: Scroll Damping */}
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

              {/* Toggle: Scroll Snapping */}
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

              {/* SKY ATMOSPHERE */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-400 tracking-wider mt-4 mb-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Sky Atmosphere</span>
              </div>

              {/* Toggle: Sky Dome */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">SHOW GLOWING SKY</span>
                <button
                  onClick={() => updateSetting("showSky", !settings.showSky)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showSky ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showSky ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider: Sky Exposure */}
              {settings.showSky && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">SKY EXPOSURE</span>
                    <span className="text-emerald-300">{settings.skyExposure.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="4.0"
                    step="0.05"
                    value={settings.skyExposure}
                    onChange={(e) => updateSetting("skyExposure", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Color: Sky Color */}
              {settings.showSky && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">SKY GLOW COLOR</span>
                    <span className="text-emerald-300">{settings.skyColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.skyColor}
                      onChange={(e) => updateSetting("skyColor", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">Select color</span>
                  </div>
                </div>
              )}

              {/* ENVIRONMENTAL FOG */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-400 tracking-wider mt-4 mb-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Environmental Fog</span>
              </div>

              {/* Toggle: Show Fog */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400 font-mono text-[10px]">SHOW DISTANT FOG</span>
                <button
                  onClick={() => updateSetting("showFog", !settings.showFog)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showFog ? "bg-emerald-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showFog ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider: Fog Near */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FOG NEAR DISTANCE</span>
                    <span className="text-emerald-300">{settings.fogNear.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range"
                    min="5.0"
                    max="500.0"
                    step="5.0"
                    value={settings.fogNear}
                    onChange={(e) => updateSetting("fogNear", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Fog Far */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FOG FAR DISTANCE</span>
                    <span className="text-emerald-300">{settings.fogFar.toFixed(0)}u</span>
                  </div>
                  <input
                    type="range"
                    min="50.0"
                    max="1500.0"
                    step="10.0"
                    value={settings.fogFar}
                    onChange={(e) => updateSetting("fogFar", parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Color: Fog Color */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-400">FOG MIST COLOR</span>
                    <span className="text-emerald-300">{settings.fogColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.fogColor}
                      onChange={(e) => updateSetting("fogColor", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">Select color</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Fixed Position Grass Reveal Debugger HUD */}
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

