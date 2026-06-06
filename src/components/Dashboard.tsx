"use client";

import React, { useState } from "react";
import { useSimulation, PresetType } from "@/context/SimulationContext";
import { 
  Sliders, 
  Sparkles, 
  Camera, 
  ChevronRight, 
  ChevronLeft,
  Info
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const { settings, updateSetting, applyPreset } = useSimulation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"presets" | "rendering" | "focus">("presets");

  const presets: { id: PresetType; label: string; desc: string; color: string }[] = [
    { id: "neon", label: "Neon Haze", desc: "Violet glows and strong noise displacement", color: "bg-purple-500" },
    { id: "muted", label: "Teal Forest", desc: "Calm green-teal with soft atmosphere", color: "bg-teal-500" },
    { id: "volcanic", label: "Volcanic Ash", desc: "Intense orange tints and heavy fog", color: "bg-orange-500" },
    { id: "emerald", label: "Emerald Valley", desc: "Lush green hues and moderate depth", color: "bg-emerald-500" },
    { id: "monochrome", label: "Monochrome", desc: "Pure grayscale depth visualization", color: "bg-gray-400" },
  ];

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none select-none z-20 font-sans text-slate-100 flex flex-col justify-between p-6">
      
      {/* Top Header Panel */}
      <header className="w-full flex justify-between items-start pointer-events-auto">
        <div className="bg-slate-950/60 backdrop-blur-md border border-white/5 rounded-xl px-5 py-3 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <h1 className="text-sm font-semibold tracking-widest uppercase text-slate-300">Volumetric Engine</h1>
          </div>
          <p className="text-xs text-slate-500 font-mono">Model: MiDaS v3.1 BEiTL-512</p>
        </div>

      </header>

      {/* Main Interactive HUD Controls (Right-aligned Sidebar) */}
      <main className="absolute right-6 top-28 bottom-28 flex items-stretch pointer-events-auto">
        {/* Toggle Collapse Button */}
        <div className="flex items-center">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="bg-slate-950/70 border border-white/10 hover:border-purple-500 hover:text-purple-400 text-slate-400 p-2 rounded-l-lg backdrop-blur-md cursor-pointer transition-all"
          >
            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Sidebar Container */}
        <div 
          className={`bg-slate-950/70 backdrop-blur-lg border-y border-r border-white/10 rounded-r-xl w-80 p-5 flex flex-col gap-5 transition-all duration-300 overflow-y-auto ${
            isCollapsed ? "opacity-0 w-0 pointer-events-none translate-x-8" : "opacity-100"
          }`}
        >
          {/* Tab Navigation */}
          <div className="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/5 text-xs font-medium text-slate-400">
            <button 
              onClick={() => setActiveTab("presets")}
              className={`py-1.5 rounded cursor-pointer transition-all ${activeTab === "presets" ? "bg-purple-600 text-white font-semibold" : "hover:text-slate-200"}`}
            >
              Presets
            </button>
            <button 
              onClick={() => setActiveTab("rendering")}
              className={`py-1.5 rounded cursor-pointer transition-all ${activeTab === "rendering" ? "bg-purple-600 text-white font-semibold" : "hover:text-slate-200"}`}
            >
              Sim
            </button>
            <button 
              onClick={() => setActiveTab("focus")}
              className={`py-1.5 rounded cursor-pointer transition-all ${activeTab === "focus" ? "bg-purple-600 text-white font-semibold" : "hover:text-slate-200"}`}
            >
              Camera
            </button>
          </div>

          {/* TAB 1: PRESETS */}
          {activeTab === "presets" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Atmospheric Themes</span>
              </div>
              <div className="flex flex-col gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      settings.activePreset === p.id 
                        ? "bg-purple-950/20 border-purple-500 text-white" 
                        : "bg-slate-900/30 border-white/5 text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
                      <span className="text-xs font-semibold">{p.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-normal leading-relaxed">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: RENDERING CONFIG */}
          {activeTab === "rendering" && (
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mb-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Particle & Noise Params</span>
              </div>

              {/* Grid Density Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Particle Grid Size</span>
                <div className="grid grid-cols-3 gap-1">
                  {([256, 512, 768, 1024, 1536, 2048] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting("gridSize", size)}
                      className={`py-1 rounded border text-center font-mono cursor-pointer transition-all ${
                        settings.gridSize === size 
                          ? "bg-purple-950/40 border-purple-500 text-purple-300 font-bold" 
                          : "bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider: Glitch Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">GLITCH BURST INTENSITY</span>
                  <span className="text-slate-300">{settings.glitchIntensity.toFixed(2)}x</span>
                </div>
                <input 
                  type="range" min="0.0" max="3.0" step="0.1"
                  value={settings.glitchIntensity} 
                  onChange={(e) => updateSetting("glitchIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Glitch Interval */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">GLITCH INTERVAL (CALM)</span>
                  <span className="text-slate-300">{settings.glitchInterval.toFixed(1)}s</span>
                </div>
                <input 
                  type="range" min="0.5" max="8.0" step="0.5"
                  value={settings.glitchInterval} 
                  onChange={(e) => updateSetting("glitchInterval", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Glitch Duration */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">GLITCH BURST DURATION</span>
                  <span className="text-slate-300">{settings.glitchDuration.toFixed(2)}s</span>
                </div>
                <input 
                  type="range" min="0.1" max="1.5" step="0.1"
                  value={settings.glitchDuration} 
                  onChange={(e) => updateSetting("glitchDuration", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: BG Glitch Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BG GLITCH INTENSITY</span>
                  <span className="text-slate-300">{settings.bgGlitchIntensity.toFixed(2)}x</span>
                </div>
                <input 
                  type="range" min="0.0" max="5.0" step="0.1"
                  value={settings.bgGlitchIntensity} 
                  onChange={(e) => updateSetting("bgGlitchIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: BG Glitch Interval */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BG GLITCH INTERVAL (CALM)</span>
                  <span className="text-slate-300">{settings.bgGlitchInterval.toFixed(1)}s</span>
                </div>
                <input 
                  type="range" min="0.5" max="8.0" step="0.5"
                  value={settings.bgGlitchInterval} 
                  onChange={(e) => updateSetting("bgGlitchInterval", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: BG Glitch Duration */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BG GLITCH BURST DURATION</span>
                  <span className="text-slate-300">{settings.bgGlitchDuration.toFixed(2)}s</span>
                </div>
                <input 
                  type="range" min="0.1" max="1.5" step="0.1"
                  value={settings.bgGlitchDuration} 
                  onChange={(e) => updateSetting("bgGlitchDuration", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Particle Size */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">PARTICLE BASE SIZE</span>
                  <span className="text-slate-300">{settings.pointSize.toFixed(1)}px</span>
                </div>
                <input 
                  type="range" min="1.0" max="12.0" step="0.5"
                  value={settings.pointSize} 
                  onChange={(e) => updateSetting("pointSize", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Noise Displacement */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">ATMOSPHERIC JITTER</span>
                  <span className="text-slate-300">{settings.noiseStrength.toFixed(2)}u</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.5" step="0.05"
                  value={settings.noiseStrength} 
                  onChange={(e) => updateSetting("noiseStrength", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Noise Speed */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">JITTER WIND SPEED</span>
                  <span className="text-slate-300">{settings.noiseSpeed.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.0" max="2.0" step="0.1"
                  value={settings.noiseSpeed} 
                  onChange={(e) => updateSetting("noiseSpeed", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Haze Density */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">ATMOSPHERE HAZE DENSITY</span>
                  <span className="text-slate-300">{settings.hazeDensity.toFixed(2)}x</span>
                </div>
                <input 
                  type="range" min="0.0" max="2.0" step="0.05"
                  value={settings.hazeDensity} 
                  onChange={(e) => updateSetting("hazeDensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Scatter Radius */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">SCATTER RADIUS</span>
                  <span className="text-slate-300">{settings.scatterRadius?.toFixed(1) || "2.0"}u</span>
                </div>
                <input 
                  type="range" min="0.5" max="6.0" step="0.5"
                  value={settings.scatterRadius || 2.0} 
                  onChange={(e) => updateSetting("scatterRadius", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Scatter Strength */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">SCATTER STRENGTH</span>
                  <span className="text-slate-300">{settings.scatterStrength?.toFixed(1) || "3.0"}u</span>
                </div>
                <input 
                  type="range" min="0.0" max="10.0" step="0.5"
                  value={settings.scatterStrength || 3.0} 
                  onChange={(e) => updateSetting("scatterStrength", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal">
                  Hover over the model to scatter particles away from your cursor. Particles stay within the bounding box and smoothly return.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: FOCUS & CAM CONFIG */}
          {activeTab === "focus" && (
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mb-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Optics & Perspective</span>
              </div>

              {/* Slider: Focus Distance */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">FOCAL DISTANCE (DEPTH)</span>
                  <span className="text-slate-300">{settings.focusDepth.toFixed(1)}u</span>
                </div>
                <input 
                  type="range" min="3.0" max="25.0" step="0.5"
                  value={settings.focusDepth} 
                  onChange={(e) => updateSetting("focusDepth", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Focus Range */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">IN-FOCUS FIELD DEPTH</span>
                  <span className="text-slate-300">±{settings.focusRange.toFixed(1)}u</span>
                </div>
                <input 
                  type="range" min="0.5" max="8.0" step="0.2"
                  value={settings.focusRange} 
                  onChange={(e) => updateSetting("focusRange", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Bokeh Scale */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BOKEH SCALE (DEFOCUS SIZE)</span>
                  <span className="text-slate-300">{settings.bokehScale.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.0" max="8.0" step="0.2"
                  value={settings.bokehScale} 
                  onChange={(e) => updateSetting("bokehScale", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Density Culling (focused vs non-focused) */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">FOCAL DENSITY CULLING</span>
                  <span className="text-slate-300">{(settings.densityControl * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" min="0.0" max="1.0" step="0.05"
                  value={settings.densityControl} 
                  onChange={(e) => updateSetting("densityControl", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal">
                  Drops out-of-focus particles, clustering density purely in the focused region for an atmospheric, noisy grain texture.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Control Bar */}
      <footer className="w-full flex justify-between items-end pointer-events-auto">
        {/* Help Panel */}
        <div className="bg-slate-950/60 backdrop-blur-md border border-white/5 rounded-xl px-5 py-4 w-96 flex gap-3 text-xs leading-relaxed text-slate-400">
          <Info className="w-5 h-5 text-purple-400 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-slate-200">Interactive Controls</span>
            <p>Drag mouse left/right/up/down to rotate camera. Scroll to zoom.</p>
          </div>
        </div>
      </footer>

    </div>
  );
};
