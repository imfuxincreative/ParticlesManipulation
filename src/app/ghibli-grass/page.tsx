'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GHIBLI_PALETTES } from '@/shaders/ghibliShader';
import {
  Sun,
  Wind,
  Layers,
  Palette,
  RotateCw,
  Sparkles,
  ArrowLeft,
  Info,
  Sliders,
  Play,
  Pause,
} from 'lucide-react';

// Disable SSR for 3D R3F Canvas
const GhibliSceneContainer = dynamic(
  () => import('@/components/ghibli/GhibliSceneContainer').then((mod) => mod.GhibliSceneContainer),
  { ssr: false }
);

export default function GhibliGrassPage() {
  const [activePalette, setActivePalette] = useState<keyof typeof GHIBLI_PALETTES>('summer');
  const [customColors, setCustomColors] = useState<string[]>([
    GHIBLI_PALETTES.summer.colors[0],
    GHIBLI_PALETTES.summer.colors[1],
    GHIBLI_PALETTES.summer.colors[2],
    GHIBLI_PALETTES.summer.colors[3],
  ]);
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [windSpeed, setWindSpeed] = useState(1.2);
  const [windStrength, setWindStrength] = useState(0.3);
  const [grassCount, setGrassCount] = useState(18000);
  const [lightX, setLightX] = useState(15);
  const [lightY, setLightY] = useState(20);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom' | 'wind' | 'environment'>('presets');

  const handlePaletteSelect = (key: keyof typeof GHIBLI_PALETTES) => {
    setActivePalette(key);
    setUseCustomColors(false);
    setCustomColors([...GHIBLI_PALETTES[key].colors]);
  };

  const handleColorChange = (index: number, hex: string) => {
    const updated = [...customColors];
    updated[index] = hex;
    setCustomColors(updated);
    setUseCustomColors(true);
  };

  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none text-slate-100">
      {/* 3D WebGL Canvas Layer */}
      <div className="absolute inset-0 w-full h-full z-0">
        <GhibliSceneContainer
          paletteKey={activePalette}
          customColors={useCustomColors ? customColors : undefined}
          windSpeed={windSpeed}
          windStrength={windStrength}
          grassCount={grassCount}
          lightPos={[lightX, lightY, 15]}
          autoRotate={autoRotate}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/60 backdrop-blur-md text-sm font-medium transition-all shadow-lg hover:border-emerald-500/50"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Back to Main Scene</span>
          </Link>

          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md shadow-lg">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold text-sm tracking-wide bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
              Ghibli Grass & Foliage Shader
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold backdrop-blur-md transition-all shadow-lg ${autoRotate
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
              }`}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>Orbit {autoRotate ? 'On' : 'Off'}</span>
          </button>

          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 backdrop-blur-md text-slate-300 hover:text-white transition-all shadow-lg"
            title="Shader Information"
          >
            <Info className="w-5 h-5 text-emerald-400" />
          </button>
        </div>
      </header>

      {/* Floating Control Panel */}
      <aside className="absolute bottom-6 left-6 z-20 w-80 md:w-96 rounded-2xl bg-slate-900/85 border border-slate-700/70 backdrop-blur-xl shadow-2xl p-5 pointer-events-auto transition-all">
        {/* Panel Header & Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">Shader Studio</h2>
          </div>

          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${activeTab === 'presets' ? 'bg-emerald-500/30 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
            >
              Presets
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${activeTab === 'custom' ? 'bg-emerald-500/30 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
            >
              Palette
            </button>
            <button
              onClick={() => setActiveTab('wind')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${activeTab === 'wind' ? 'bg-emerald-500/30 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
            >
              Wind
            </button>
            <button
              onClick={() => setActiveTab('environment')}
              className={`px-2.5 py-1 text-xs rounded-md transition-all ${activeTab === 'environment' ? 'bg-emerald-500/30 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
            >
              Light
            </button>
          </div>
        </div>

        {/* Tab 1: Presets */}
        {activeTab === 'presets' && (
          <div className="mt-4 space-y-2.5">
            <label className="text-xs text-slate-400 font-medium">Select Ghibli Color Palette</label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {(Object.keys(GHIBLI_PALETTES) as Array<keyof typeof GHIBLI_PALETTES>).map((key) => {
                const pal = GHIBLI_PALETTES[key];
                const isSelected = !useCustomColors && activePalette === key;
                return (
                  <button
                    key={key}
                    onClick={() => handlePaletteSelect(key)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/80 shadow-md shadow-emerald-950'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                  >
                    <span className="text-xs font-semibold text-slate-200">{pal.name}</span>
                    <div className="flex items-center gap-1">
                      {pal.colors.map((c, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full border border-slate-900/80 shadow-sm"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Custom 4-Step Palette */}
        {activeTab === 'custom' && (
          <div className="mt-4 space-y-3">
            <label className="text-xs text-slate-400 font-medium">4-Step Quantization Palette</label>
            <div className="grid grid-cols-2 gap-3">
              {['Highlight', 'Midtone 1', 'Midtone 2', 'Shadow'].map((label, idx) => (
                <div key={idx} className="flex flex-col gap-1 p-2 rounded-xl bg-slate-950/50 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-medium">{label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={useCustomColors ? customColors[idx] : GHIBLI_PALETTES[activePalette].colors[idx]}
                      onChange={(e) => handleColorChange(idx, e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-xs font-mono text-slate-300">
                      {useCustomColors ? customColors[idx] : GHIBLI_PALETTES[activePalette].colors[idx]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {useCustomColors && (
              <button
                onClick={() => setUseCustomColors(false)}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all"
              >
                Reset to Active Preset
              </button>
            )}
          </div>
        )}

        {/* Tab 3: Wind Animation Controls */}
        {activeTab === 'wind' && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" /> Wind Speed
                </span>
                <span className="text-cyan-300 font-mono font-semibold">{windSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={windSpeed}
                onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-400" /> Wind Strength
                </span>
                <span className="text-teal-300 font-mono font-semibold">{windStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={windStrength}
                onChange={(e) => setWindStrength(parseFloat(e.target.value))}
                className="w-full accent-teal-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" /> Grass Density
                </span>
                <span className="text-emerald-300 font-mono font-semibold">{grassCount.toLocaleString()} blades</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[8000, 18000, 30000].map((count) => (
                  <button
                    key={count}
                    onClick={() => setGrassCount(count)}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all border ${grassCount === count
                        ? 'bg-emerald-500/25 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {count === 8000 ? 'Low' : count === 18000 ? 'Medium' : 'High'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Environment Light Controls */}
        {activeTab === 'environment' && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" /> Sunlight Orbit X
                </span>
                <span className="text-amber-300 font-mono font-semibold">{lightX}</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={lightX}
                onChange={(e) => setLightX(parseInt(e.target.value))}
                className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-300" /> Sunlight Altitude Y
                </span>
                <span className="text-amber-200 font-mono font-semibold">{lightY}</span>
              </div>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                value={lightY}
                onChange={(e) => setLightY(parseInt(e.target.value))}
                className="w-full accent-amber-300 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}
      </aside>

      {/* Information Modal Overlay */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg text-slate-100">About Craftzdog Ghibli Grass Shader</h3>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                This shader system is built on the technique designed by{' '}
                <a
                  href="https://github.com/craftzdog/ghibli-style-shader"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline font-semibold hover:text-emerald-300"
                >
                  Takuya Matsuyama (@craftzdog)
                </a>
                .
              </p>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-emerald-300">Key Architectural Features:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">4-Step Quantization:</strong> Maps normal-to-light dot product angles into 4 distinct color bands to create classic Studio Ghibli cel-shaded foliage.
                  </li>
                  <li>
                    <strong className="text-slate-200">GPU Instanced Grass Field:</strong> Generates up to 30,000 instanced grass blades at 60+ FPS.
                  </li>
                  <li>
                    <strong className="text-slate-200">GLSL Vertex Wind Noise:</strong> Uses procedural Simplex noise to animate grass tip sway and foliage movement organically.
                  </li>
                  <li>
                    <strong className="text-slate-200">Subsurface Scattering (SSS):</strong> Simulates sunlight filtering softly through grass blades and tree foliage.
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-semibold text-slate-950 text-sm transition-all"
            >
              Close & Explore Scene
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
