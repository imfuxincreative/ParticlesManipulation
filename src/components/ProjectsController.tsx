"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useSimulation } from "@/context/SimulationContext";

export interface ProjectsControllerProps {
  targetFrame?: number;
  fadeInStart?: number;
  fullStart?: number;
  fullEnd?: number;
  fadeOutEnd?: number;
}

export const ProjectsController: React.FC<ProjectsControllerProps> = ({
  targetFrame = 3846,
  fadeInStart = 3780, // Starts appearing close to project checkpoint 3846
  fullStart = 3830,   // Reaches full opacity right before 3846
  fullEnd = 3860,     // Stays full opacity centered around 3846
  fadeOutEnd = 3910,  // Disappears cleanly as you move past 3846
}) => {
  const { settings, updateSetting } = useSimulation();
  const [currentFrame, setCurrentFrame] = useState<number>(-999);
  const [opacity, setOpacity] = useState<number>(0);

  // Derive project / model names from settings.models array
  const projectLabels = useMemo(() => {
    return settings.models.map((path) => {
      const filename = path.split("/").pop()?.replace(".glb", "") || "Project";
      return filename.charAt(0).toUpperCase() + filename.slice(1);
    });
  }, [settings.models]);

  useEffect(() => {
    const computeOpacity = (frame: number): number => {
      if (frame < fadeInStart || frame > fadeOutEnd) return 0;
      if (frame >= fullStart && frame <= fullEnd) return 1;
      if (frame < fullStart) {
        const t = (frame - fadeInStart) / (fullStart - fadeInStart);
        return Math.max(0, Math.min(1, t));
      } else {
        const t = (frame - fullEnd) / (fadeOutEnd - fullEnd);
        return Math.max(0, Math.min(1, 1 - t));
      }
    };

    const handleFrameChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ frame: number }>;
      const frame = customEvent.detail?.frame;
      if (typeof frame === "number" && !isNaN(frame)) {
        setCurrentFrame(frame);
        setOpacity(computeOpacity(frame));
      }
    };

    window.addEventListener("scroll-frame-change", handleFrameChange);

    // Initial frame sync on mount
    if (typeof window !== "undefined") {
      const winFrame = (window as any).particlesCurrentFrame;
      if (typeof winFrame === "number" && !isNaN(winFrame)) {
        setCurrentFrame(winFrame);
        setOpacity(computeOpacity(winFrame));
      } else {
        const frameValEl = document.getElementById("overlay-frame-val");
        if (frameValEl) {
          const parsed = parseFloat(frameValEl.innerText);
          if (!isNaN(parsed)) {
            setCurrentFrame(parsed);
            setOpacity(computeOpacity(parsed));
          }
        }
      }
    }

    return () => {
      window.removeEventListener("scroll-frame-change", handleFrameChange);
    };
  }, [fadeInStart, fullStart, fullEnd, fadeOutEnd]);

  const handleNext = () => {
    const nextIndex = (settings.currentModelIndex + 1) % settings.models.length;
    updateSetting("currentModelIndex", nextIndex);
  };

  const handlePrev = () => {
    const prevIndex =
      (settings.currentModelIndex - 1 + settings.models.length) % settings.models.length;
    updateSetting("currentModelIndex", prevIndex);
  };

  // Forward wheel events over buttons to Lenis so scrolling on arrows doesn't stall
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (typeof window !== "undefined" && (window as any).lenis) {
      const lenis = (window as any).lenis;
      lenis.scrollTo(lenis.targetScroll + e.deltaY * 0.8, { immediate: true });
    }
  }, []);

  if (!settings.models || settings.models.length === 0) return null;

  const isInteractive = opacity > 0.02;
  const scale = 0.9 + 0.1 * opacity;
  const currentProjectName = projectLabels[settings.currentModelIndex] || "Project";
  const projectNumberStr = `${String(settings.currentModelIndex + 1).padStart(2, "0")} / ${String(
    settings.models.length
  ).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-between px-6 md:px-12 pointer-events-none select-none transition-all duration-300 ease-out"
      style={{
        opacity: opacity,
        transform: `scale(${scale})`,
        pointerEvents: "none",
      }}
    >
      {/* Left Navigation Arrow */}
      <button
        onClick={handlePrev}
        onWheel={handleWheel}
        aria-label="Previous Project"
        title="Previous Project"
        style={{ pointerEvents: isInteractive ? "auto" : "none" }}
        className="group relative p-4 md:p-5 rounded-full bg-slate-950/70 hover:bg-purple-950/80 backdrop-blur-xl border border-purple-500/30 hover:border-purple-400/80 text-purple-200 hover:text-white shadow-2xl shadow-purple-950/50 transition-all duration-300 transform hover:scale-115 active:scale-90 flex items-center justify-center cursor-pointer"
      >
        <div className="absolute inset-0 rounded-full bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
        <ChevronLeft className="w-7 h-7 md:w-9 md:h-9 transition-transform group-hover:-translate-x-0.5" />
      </button>

      {/* Center Projects Controller Status Pill */}
      <div
        onWheel={handleWheel}
        style={{ pointerEvents: isInteractive ? "auto" : "none" }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-950/80 backdrop-blur-2xl border border-purple-500/40 px-5 py-2.5 rounded-full shadow-2xl shadow-purple-950/60"
      >
        <div className="p-1.5 rounded-full bg-purple-900/50 text-purple-400">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-semibold">
              PROJECT CONTROLLER
            </span>
            <span className="text-[10px] font-mono text-slate-500">•</span>
            <span className="text-[10px] font-mono tracking-wider text-slate-400">
              {projectNumberStr}
            </span>
          </div>
          <span className="text-xs font-mono font-bold tracking-wider text-white uppercase drop-shadow">
            {currentProjectName}
          </span>
        </div>
      </div>

      {/* Right Navigation Arrow */}
      <button
        onClick={handleNext}
        onWheel={handleWheel}
        aria-label="Next Project"
        title="Next Project"
        style={{ pointerEvents: isInteractive ? "auto" : "none" }}
        className="group relative p-4 md:p-5 rounded-full bg-slate-950/70 hover:bg-purple-950/80 backdrop-blur-xl border border-purple-500/30 hover:border-purple-400/80 text-purple-200 hover:text-white shadow-2xl shadow-purple-950/50 transition-all duration-300 transform hover:scale-115 active:scale-90 flex items-center justify-center cursor-pointer"
      >
        <div className="absolute inset-0 rounded-full bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
        <ChevronRight className="w-7 h-7 md:w-9 md:h-9 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
};
