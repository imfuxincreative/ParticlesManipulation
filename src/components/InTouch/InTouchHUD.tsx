"use client";

import React, { useEffect, useState } from "react";
import { useLoopTransition } from "@/components/transitions/transitionConfig";
import { RotateCcw } from "lucide-react";

export const InTouchHUD: React.FC = () => {
  const activeScene = useLoopTransition((s) => s.activeScene);
  const inTouchState = useLoopTransition((s) => s.inTouchState);
  const isTransitioning = useLoopTransition((s) => s.isTransitioning);
  const returnToMainScene = useLoopTransition((s) => s.returnToMainScene);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeScene === "inTouch" && inTouchState === "active" && !isTransitioning) {
      timer = setTimeout(() => {
        setVisible(true);
      }, 700);
    } else {
      setVisible(false);
    }
    return () => clearTimeout(timer);
  }, [activeScene, inTouchState, isTransitioning]);

  if (activeScene !== "inTouch" && !visible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-30 flex flex-col justify-between items-center p-6 md:p-8 select-none transition-opacity duration-1000 ${
        visible && !isTransitioning ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Top Atmosphere Subtitle */}
      <div className="pt-2 text-center pointer-events-auto">
        <p className="text-[11px] sm:text-xs uppercase tracking-[0.35em] text-red-200/60 font-mono">
          Interactive Scene // inTouch
        </p>
      </div>

      {/* Bottom Controls / Prompt */}
      <div className="pb-4 flex flex-col items-center gap-3 pointer-events-auto">
        <button
          onClick={() => returnToMainScene("first")}
          className="group flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-red-950/40 hover:bg-red-900/60 border border-red-500/25 hover:border-red-400/50 backdrop-blur-md text-red-100 text-xs sm:text-sm font-medium tracking-wider transition-all duration-300 shadow-[0_4px_24px_rgba(255,0,20,0.15)] hover:shadow-[0_4px_32px_rgba(255,0,20,0.35)] cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-red-400 group-hover:-rotate-90 transition-transform duration-300" />
          <span>Return to Journey</span>
        </button>

        <p className="text-[10px] sm:text-xs text-red-300/40 tracking-widest font-mono">
          Scroll down or click to loop &bull; Scroll up to return to scene
        </p>
      </div>
    </div>
  );
};
