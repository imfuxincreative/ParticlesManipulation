"use client";

import React, { useState, useEffect } from "react";
import { useSimulation } from "@/context/SimulationContext";
import {
  Sliders,
  Sparkles,
  Camera,
  Menu,
  X
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const { settings, updateSetting } = useSimulation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState<"rendering" | "focus">("rendering");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsCollapsed(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none select-none z-20 font-sans text-slate-100 flex flex-col justify-between p-6">

      {/* Burger Menu Button in Top Right Corner */}
      <div className="fixed top-6 right-6 z-40 pointer-events-auto">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="  flex items-center justify-center"
          aria-label="Toggle Menu"
        >
          {isCollapsed ? <Menu className="w-5 h-5 text-black" /> : <X className="w-5 h-5 text-black" />}
        </button>
      </div>

      {/* Main Interactive HUD Controls (Right-aligned Sidebar) */}
      <main className="absolute right-4 md:right-6 top-20 md:top-28 bottom-20 md:bottom-28 flex items-stretch pointer-events-none z-30">
        {/* Sidebar Container */}
        <div
          className={`bg-slate-950/70 backdrop-blur-lg border border-white/10 rounded-xl w-72 md:w-80 p-5 flex flex-col gap-5 transition-all duration-300 overflow-y-auto ${isCollapsed ? "opacity-0 w-0 pointer-events-none translate-x-8" : "opacity-100 pointer-events-auto"
            }`}
        >
          {/* Tab Navigation */}
          <div className="grid grid-cols-2 gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/5 text-xs font-medium text-slate-400">
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
                  {([128, 256, 512, 768, 1024, 1536, 2048] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateSetting("gridSize", size)}
                      className={`py-1 rounded border text-center font-mono cursor-pointer transition-all ${settings.gridSize === size
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
                  type="range" min="1.0" max="120.0" step="0.5"
                  value={settings.pointSize}
                  onChange={(e) => updateSetting("pointSize", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Color: Particle Color */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">PARTICLE DEFAULT COLOR</span>
                  <span className="text-slate-300">{settings.particleDefaultColor || "#8d8d8d"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.particleDefaultColor || "#8d8d8d"}
                    onChange={(e) => updateSetting("particleDefaultColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Select color</span>
                </div>
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

              {/* MODEL FLOW / RIPPLE CONFIG */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mt-4 mb-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Model Ripple Settings</span>
              </div>

              {/* Slider: Flow Speed */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">RIPPLE FLOW SPEED</span>
                  <span className="text-slate-300">{settings.modelFlowSpeed.toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.0" max="2.0" step="0.05"
                  value={settings.modelFlowSpeed}
                  onChange={(e) => updateSetting("modelFlowSpeed", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Flow Strength */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">RIPPLE STRENGTH</span>
                  <span className="text-slate-300">{settings.modelFlowStrength.toFixed(2)}u</span>
                </div>
                <input
                  type="range" min="0.0" max="10.0" step="0.05"
                  value={settings.modelFlowStrength}
                  onChange={(e) => updateSetting("modelFlowStrength", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Flow Frequency */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">RIPPLE FREQUENCY (SCALE)</span>
                  <span className="text-slate-300">{settings.modelFlowFrequency.toFixed(3)}</span>
                </div>
                <input
                  type="range" min="0.01" max="1.0" step="0.01"
                  value={settings.modelFlowFrequency}
                  onChange={(e) => updateSetting("modelFlowFrequency", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Flow Clumping / Unevenness */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">RIPPLE CLUMPING (UNEVENNESS)</span>
                  <span className="text-slate-300">{(settings.modelFlowClumping * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range" min="0.0" max="1.0" step="0.05"
                  value={settings.modelFlowClumping}
                  onChange={(e) => updateSetting("modelFlowClumping", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal">
                  Modulates displacement with a low-frequency mask. Higher values create organic clumping and uneven scattering, leaving some areas solid.
                </p>
              </div>

              {/* Slider: Flow Normal Limit */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">SHAPE DISPLACEMENT LIMIT</span>
                  <span className="text-slate-300">{settings.modelFlowNormalLimit.toFixed(3)}u</span>
                </div>
                <input
                  type="range" min="0.0" max="20.0" step="0.01"
                  value={settings.modelFlowNormalLimit}
                  onChange={(e) => updateSetting("modelFlowNormalLimit", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal">
                  Restricts movement perpendicular to the surface. Set to 0 to keep particles completely inside the original shape.
                </p>
              </div>

              {/* Slider: Scatter Color Scale */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">RIPPLE GLOW COLOR SENSITIVITY</span>
                  <span className="text-slate-300">{settings.modelScatterColorScale.toFixed(3)}x</span>
                </div>
                <input
                  type="range" min="0.000" max="0.500" step="0.005"
                  value={settings.modelScatterColorScale}
                  onChange={(e) => updateSetting("modelScatterColorScale", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal">
                  Controls how quickly particles turn pink/glow based on displacement distance. High values cause more pink coloring.
                </p>
              </div>

              {/* HOLOGRAPHIC ARCHITECTURE */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mt-4 mb-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Architecture Config</span>
              </div>

              {/* Slider: Fill Opacity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BASE FILL OPACITY</span>
                  <span className="text-slate-300">{settings.xrayFillOpacity?.toFixed(2) || "0.15"}</span>
                </div>
                <input
                  type="range" min="0.0" max="1.0" step="0.01"
                  value={settings.xrayFillOpacity || 0.15}
                  onChange={(e) => updateSetting("xrayFillOpacity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: City Hologram Opacity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">CITY HOLOGRAM OPACITY</span>
                  <span className="text-slate-300">{(settings.cityHologramOpacity ?? 1.0).toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.0" max="2.0" step="0.02"
                  value={settings.cityHologramOpacity ?? 1.0}
                  onChange={(e) => updateSetting("cityHologramOpacity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Outline Power */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">OUTLINE SHARPNESS</span>
                  <span className="text-slate-300">{settings.xrayOutlinePower?.toFixed(1) || "2.5"}</span>
                </div>
                <input
                  type="range" min="0.5" max="8.0" step="0.1"
                  value={settings.xrayOutlinePower || 2.5}
                  onChange={(e) => updateSetting("xrayOutlinePower", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Scanline Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">SCANLINE INTENSITY</span>
                  <span className="text-slate-300">{settings.xrayScanlineIntensity?.toFixed(2) || "0.00"}</span>
                </div>
                <input
                  type="range" min="0.0" max="1.0" step="0.05"
                  value={settings.xrayScanlineIntensity || 0.0}
                  onChange={(e) => updateSetting("xrayScanlineIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Color: Outline Color */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">OUTLINE GLOW COLOR</span>
                  <span className="text-slate-300">{settings.xrayOutlineColor || "#ffffff"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.xrayOutlineColor || "#ffffff"}
                    onChange={(e) => updateSetting("xrayOutlineColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-slate-500">Select color</span>
                </div>
              </div>

              {/* Color: Base Color */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BASE FILL COLOR</span>
                  <span className="text-slate-300">{settings.xrayBaseColor || "#888888"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.xrayBaseColor || "#888888"}
                    onChange={(e) => updateSetting("xrayBaseColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-slate-500">Select color</span>
                </div>
              </div>

              {/* Slider: Border Opacity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BORDER OPACITY (THIN LINES)</span>
                  <span className="text-slate-300">{settings.xrayBorderOpacity?.toFixed(2) || "0.50"}</span>
                </div>
                <input
                  type="range" min="0.0" max="1.0" step="0.01"
                  value={settings.xrayBorderOpacity || 0.5}
                  onChange={(e) => updateSetting("xrayBorderOpacity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Border Glow Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BORDER GLOW INTENSITY</span>
                  <span className="text-slate-300">{settings.xrayLineGlowIntensity?.toFixed(1) || "2.5"}x</span>
                </div>
                <input
                  type="range" min="0.0" max="5.0" step="0.1"
                  value={settings.xrayLineGlowIntensity ?? 2.5}
                  onChange={(e) => updateSetting("xrayLineGlowIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Border Spread / Complexity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">EDGE DETAIL (COMPLEXITY)</span>
                  <span className="text-slate-300">{(89 - (settings.xrayBorderThreshold ?? 15)).toFixed(0)}</span>
                </div>
                <input
                  type="range" min="0" max="89" step="1"
                  value={89 - (settings.xrayBorderThreshold ?? 15)}
                  onChange={(e) => updateSetting("xrayBorderThreshold", 89 - parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Border Reveal Depth */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">LINE REVEAL DEPTH</span>
                  <span className="text-slate-300">{settings.xrayBorderRevealDepth?.toFixed(0) || "400"}u</span>
                </div>
                <input
                  type="range" min="5" max="1000" step="5"
                  value={settings.xrayBorderRevealDepth || 400}
                  onChange={(e) => updateSetting("xrayBorderRevealDepth", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal mt-1">
                  Low = only closest faces show lines. High = lines spread deep inside. Animates with 0.2s delay.
                </p>
              </div>

              {/* Slider: Solid & Ground Fade Depth */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">SOLID & GROUND FADE DEPTH</span>
                  <span className="text-slate-300">{settings.xraySolidRevealDepth?.toFixed(0) || "300"}u</span>
                </div>
                <input
                  type="range" min="5" max="1000" step="5"
                  value={settings.xraySolidRevealDepth || 300}
                  onChange={(e) => updateSetting("xraySolidRevealDepth", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal mt-1">
                  Low = only buildings and ground close to camera are visible. High = visible at greater distance. Animates with 0.2s delay.
                </p>
              </div>

              {/* Slider: Hover Light Radius */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">HOVER LIGHT RADIUS</span>
                  <span className="text-slate-300">{settings.xrayHoverRadius?.toFixed(1) || "10.0"}u</span>
                </div>
                <input
                  type="range" min="0.0" max="100.0" step="1.0"
                  value={settings.xrayHoverRadius ?? 10.0}
                  onChange={(e) => updateSetting("xrayHoverRadius", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Color: Border Color */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BORDER COLOR</span>
                  <span className="text-slate-300">{settings.xrayBorderColor || "#e91e63"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.xrayBorderColor || "#e91e63"}
                    onChange={(e) => updateSetting("xrayBorderColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-slate-500">Select color</span>
                </div>
              </div>

              {/* Toggle: Grid Floor */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-mono text-[10px]">SHOW GRID FLOOR</span>
                <button
                  onClick={() => updateSetting("showGridFloor", !settings.showGridFloor)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showGridFloor ? "bg-purple-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showGridFloor ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider: Grid Floor Opacity */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">GRID FLOOR OPACITY</span>
                    <span className="text-slate-300">{(settings.gridFloorOpacity * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range" min="0.0" max="1.0" step="0.05"
                    value={settings.gridFloorOpacity}
                    onChange={(e) => updateSetting("gridFloorOpacity", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Tile Size */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">GRID TILE SIZE</span>
                    <span className="text-slate-300">{settings.gridTileSize.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="1.0" max="20.0" step="0.5"
                    value={settings.gridTileSize}
                    onChange={(e) => updateSetting("gridTileSize", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Line Width */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">GRID LINE WIDTH</span>
                    <span className="text-slate-300">{settings.gridLineWidth.toFixed(1)}px</span>
                  </div>
                  <input
                    type="range" min="0.5" max="5.0" step="0.1"
                    value={settings.gridLineWidth}
                    onChange={(e) => updateSetting("gridLineWidth", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Floor Height Y */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">GRID FLOOR HEIGHT (Y)</span>
                    <span className="text-slate-300">{settings.gridFloorY.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="-15.0" max="5.0" step="0.1"
                    value={settings.gridFloorY}
                    onChange={(e) => updateSetting("gridFloorY", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Floor Fall Radius */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FALL TRIGGER RADIUS</span>
                    <span className="text-slate-300">{settings.gridFloorFallRadius.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="5.0" max="150.0" step="1.0"
                    value={settings.gridFloorFallRadius}
                    onChange={(e) => updateSetting("gridFloorFallRadius", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Floor Fall Range */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FALL TRANSITION RANGE</span>
                    <span className="text-slate-300">{settings.gridFloorFallRadiusRange.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="1.0" max="100.0" step="1.0"
                    value={settings.gridFloorFallRadiusRange}
                    onChange={(e) => updateSetting("gridFloorFallRadiusRange", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Floor Fall Max Distance */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FALL MAX DEPTH</span>
                    <span className="text-slate-300">{settings.gridFloorFallMaxDistance.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="5.0" max="200.0" step="1.0"
                    value={settings.gridFloorFallMaxDistance}
                    onChange={(e) => updateSetting("gridFloorFallMaxDistance", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Grid Floor Fall Randomness */}
              {settings.showGridFloor && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FALL RADIUS JITTER</span>
                    <span className="text-slate-300">{settings.gridFloorFallRandomness.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="0.0" max="50.0" step="1.0"
                    value={settings.gridFloorFallRandomness}
                    onChange={(e) => updateSetting("gridFloorFallRandomness", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}


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

              {/* WING SYSTEM CONFIG */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mt-4 mb-1">
                <Sliders className="w-3.5 h-3.5" />
                <span>Wing Particle Settings</span>
              </div>

              {/* Selector: Wing Start Mode */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Wing Start Mode</span>
                <div className="grid grid-cols-3 gap-1">
                  {(["spine", "formed", "scattered"] as const).map((mode) => {
                    const label = mode === "spine" ? "Spine Core" : mode === "formed" ? "Formed" : "Scatter";
                    return (
                      <button
                        key={mode}
                        onClick={() => updateSetting("wingStartMode", mode)}
                        className={`py-1 rounded border text-center text-[10px] cursor-pointer transition-all ${settings.wingStartMode === mode
                          ? "bg-purple-950/40 border-purple-500 text-purple-300 font-bold"
                          : "bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle: Show Wing Anchor */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-mono text-[10px]">SHOW WING ANCHOR</span>
                <button
                  onClick={() => updateSetting("showWingAnchor", !settings.showWingAnchor)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showWingAnchor ? "bg-purple-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showWingAnchor ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Toggle: Show Wing System */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-mono text-[10px]">SHOW WING SYSTEM</span>
                <button
                  onClick={() => updateSetting("showWings", !settings.showWings)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showWings ? "bg-purple-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showWings ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider: Wing Flow Frequency / Detail */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">WING RIPPLE DETAIL (FREQ)</span>
                  <span className="text-slate-300">{(settings.wingFlowFrequency ?? 8.0).toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="1.0" max="20.0" step="0.5"
                  value={settings.wingFlowFrequency ?? 8.0}
                  onChange={(e) => updateSetting("wingFlowFrequency", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Wing Flow Strength / Ripple Amplitude */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">WING RIPPLE STRENGTH</span>
                  <span className="text-slate-300">{(settings.wingFlowStrength ?? 0.045).toFixed(3)}x</span>
                </div>
                <input
                  type="range" min="0.000" max="0.200" step="0.005"
                  value={settings.wingFlowStrength ?? 0.045}
                  onChange={(e) => updateSetting("wingFlowStrength", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Wing Glow Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">WING GLOW INTENSITY</span>
                  <span className="text-slate-300">{(settings.wingGlowIntensity ?? 1.5).toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="1.0" max="5.0" step="0.1"
                  value={settings.wingGlowIntensity ?? 1.5}
                  onChange={(e) => updateSetting("wingGlowIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Title Size */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">TITLE SIZE</span>
                  <span className="text-slate-300">{(settings.titleSize ?? 8.0).toFixed(1)}u</span>
                </div>
                <input
                  type="range" min="1.0" max="40.0" step="0.5"
                  value={settings.titleSize ?? 8.0}
                  onChange={(e) => updateSetting("titleSize", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider: Title Y Offset */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">TITLE Y OFFSET</span>
                  <span className="text-slate-300">{(settings.titleYOffset ?? -3.5).toFixed(2)}u</span>
                </div>
                <input
                  type="range" min="-3.0" max="3.0" step="0.1"
                  value={settings.titleYOffset ?? -0.5}
                  onChange={(e) => updateSetting("titleYOffset", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* SIMON GLOW CONFIG */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mt-4 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Character Glow</span>
              </div>

              {/* Slider: Simon Glow Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">GLOW INTENSITY</span>
                  <span className="text-slate-300">{(settings.simonGlowIntensity ?? 1.2).toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.0" max="5.0" step="0.1"
                  value={settings.simonGlowIntensity ?? 1.2}
                  onChange={(e) => updateSetting("simonGlowIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal mt-1">
                  Controls how bright the character&apos;s clothes glow. 1.0 = pure white, higher = HDR bloom trigger.
                </p>
              </div>

              {/* Slider: Simon Glow Opacity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">OUTFIT BASE OPACITY</span>
                  <span className="text-slate-300">{((settings.simonGlowOpacity ?? 0.4) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range" min="0.05" max="1.0" step="0.05"
                  value={settings.simonGlowOpacity ?? 0.4}
                  onChange={(e) => updateSetting("simonGlowOpacity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal mt-1">
                  Controls the base transparency of Simon&apos;s outfits when fully revealed.
                </p>
              </div>

              {/* Slider: Simon Bloom Intensity */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">BLOOM STRENGTH</span>
                  <span className="text-slate-300">{(settings.simonBloomIntensity ?? 0.4).toFixed(2)}x</span>
                </div>
                <input
                  type="range" min="0.0" max="3.0" step="0.05"
                  value={settings.simonBloomIntensity ?? 0.4}
                  onChange={(e) => updateSetting("simonBloomIntensity", parseFloat(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[9px] text-slate-500 leading-normal mt-1">
                  Controls the soft light halo around the glowing character. 0 = no bloom, higher = stronger halo.
                </p>
              </div>

              {/* Color: Simon Glow Color */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-500">GLOW COLOR</span>
                  <span className="text-slate-300">{settings.simonGlowColor || "#ffffff"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.simonGlowColor || "#ffffff"}
                    onChange={(e) => updateSetting("simonGlowColor", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">Select color</span>
                </div>
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

              {/* SKY DOME CONFIG */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mt-4 mb-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Sky Atmosphere</span>
              </div>

              {/* Toggle: Sky Dome */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-mono text-[10px]">SHOW GLOWING SKY</span>
                <button
                  onClick={() => updateSetting("showSky", !settings.showSky)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showSky ? "bg-purple-600" : "bg-slate-800"
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
                    <span className="text-slate-500">SKY EXPOSURE</span>
                    <span className="text-slate-300">{settings.skyExposure.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range" min="0.0" max="4.0" step="0.05"
                    value={settings.skyExposure}
                    onChange={(e) => updateSetting("skyExposure", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Sky Horizon Range */}
              {settings.showSky && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">SKY HORIZON RANGE</span>
                    <span className="text-slate-300">{settings.skyHorizonRange.toFixed(2)}</span>
                  </div>
                  <input
                    type="range" min="-2.0" max="1.0" step="0.05"
                    value={settings.skyHorizonRange}
                    onChange={(e) => updateSetting("skyHorizonRange", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Color: Sky Color */}
              {settings.showSky && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">SKY HORIZON GLOW COLOR</span>
                    <span className="text-slate-300">{settings.skyColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.skyColor}
                      onChange={(e) => updateSetting("skyColor", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] text-slate-500">Select color</span>
                  </div>
                </div>
              )}

              {/* ENVIRONMENTAL FOG CONFIG */}
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-purple-400 tracking-wider mt-4 mb-1">
                <Camera className="w-3.5 h-3.5" />
                <span>Environmental Fog</span>
              </div>

              {/* Toggle: Show Fog */}
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-mono text-[10px]">SHOW DISTANT FOG</span>
                <button
                  onClick={() => updateSetting("showFog", !settings.showFog)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer duration-200 ${settings.showFog ? "bg-purple-600" : "bg-slate-800"
                    }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${settings.showFog ? "translate-x-4" : "translate-x-0"
                      }`}
                  />
                </button>
              </div>

              {/* Slider: Fog Near (Start distance) */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FOG NEAR DISTANCE</span>
                    <span className="text-slate-300">{settings.fogNear.toFixed(1)}u</span>
                  </div>
                  <input
                    type="range" min="1.0" max="100.0" step="0.5"
                    value={settings.fogNear}
                    onChange={(e) => updateSetting("fogNear", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Fog Far (Full opacity distance) */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FOG FAR DISTANCE</span>
                    <span className="text-slate-300">{settings.fogFar.toFixed(0)}u</span>
                  </div>
                  <input
                    type="range" min="10.0" max="300.0" step="1.0"
                    value={settings.fogFar}
                    onChange={(e) => updateSetting("fogFar", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Slider: Fog Amount (Density/Strength) */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FOG MAX DENSITY</span>
                    <span className="text-slate-300">{(settings.fogAmount * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range" min="0.0" max="1.0" step="0.05"
                    value={settings.fogAmount}
                    onChange={(e) => updateSetting("fogAmount", parseFloat(e.target.value))}
                    className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}

              {/* Color: Fog Color */}
              {settings.showFog && (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-slate-500">FOG MIST COLOR</span>
                    <span className="text-slate-300">{settings.fogColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.fogColor}
                      onChange={(e) => updateSetting("fogColor", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">Select color</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>



    </div>
  );
};
