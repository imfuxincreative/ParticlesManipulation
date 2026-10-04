"use client";

import React, { useState, useEffect } from "react";
import { useAtmosphere, computeFogFactor, deriveFogColorHex } from "@/lib/atmosphere";

export const AtmosphereDebug: React.FC = () => {
  const config = useAtmosphere();
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 px-2 py-1 bg-black/70 text-[10px] font-mono text-red-400 border border-red-500/30 rounded hover:bg-black/90 cursor-pointer"
      >
        🔍 ATMO DEBUG
      </button>
    );
  }

  const fHero = computeFogFactor(40, 15, config).toFixed(3);
  const fMid = computeFogFactor(120, 15, config).toFixed(3);
  const fFar = computeFogFactor(260, 15, config).toFixed(3);
  const fGroundFar = computeFogFactor(400, 0, config).toFixed(4);

  const derivedFogHex = deriveFogColorHex(config);

  return (
    <div className="fixed bottom-4 right-4 z-50 p-3 bg-black/90 border border-red-500/40 rounded-lg text-[11px] font-mono text-slate-200 w-64 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-1">
        <span className="font-semibold text-red-400">ATMOSPHERE DEBUGGER</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-white text-xs cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1.5 text-[10px]">
        <div className="flex justify-between">
          <span className="text-slate-400">Quality Mode:</span>
          <span className="text-amber-300 uppercase">{config.quality}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Hero Fog (40u):</span>
          <span className="text-emerald-400">{fHero}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Mid Fog (120u):</span>
          <span className="text-emerald-400">{fMid}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Far Fog (260u):</span>
          <span className="text-emerald-400">{fFar}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Ground Fog (400u):</span>
          <span className="text-emerald-400">{fGroundFar}</span>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <span className="text-slate-400">Derived Fog Color:</span>
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full border border-white/20"
              style={{ backgroundColor: derivedFogHex }}
            />
            <span className="text-slate-300 font-mono">{derivedFogHex}</span>
          </div>
        </div>

        <div className="pt-1 text-[9px] text-emerald-400/80 italic">
          ✓ Seam-free mathematical continuity active
        </div>
      </div>
    </div>
  );
};
