"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { MODEL_NAMES } from "@/config/projectModels";
import { ScrambleTitle } from "./ui/ScrambleTitle";

// Architectural minimalist navigation arrows matching user reference
export const MinimalArrowLeft: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    viewBox="0 0 68 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M 18 5 L 4 19 H 64"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const MinimalArrowRight: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg
    viewBox="0 0 68 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M 4 19 H 64 L 50 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function getItemWidth(title: string, windowWidth: number): number {
  const estimatedCharWidth = Math.min(32, Math.max(14, windowWidth * 0.016));
  return Math.max(50, title.length * estimatedCharWidth + 24);
}

export interface ProjectsControllerProps {
  startFrame?: number;
  endFrame?: number;
  targetFrame?: number;
  fadeInStart?: number;
  fullStart?: number;
  fullEnd?: number;
  fadeOutEnd?: number;
  fadeDuration?: number;
}

export const ProjectsController: React.FC<ProjectsControllerProps> = ({
  startFrame = 7435,
  endFrame = 7800,
  targetFrame,
  fadeInStart,
  fullStart,
  fullEnd,
  fadeOutEnd,
  fadeDuration = 25,
}) => {
  const effStart = startFrame ?? targetFrame ?? 7435;
  const effEnd = endFrame ?? targetFrame ?? 7500;
  const effFadeInStart = fadeInStart ?? (effStart - fadeDuration);
  const effFullStart = fullStart ?? effStart;
  const effFullEnd = fullEnd ?? effEnd;
  const effFadeOutEnd = fadeOutEnd ?? (effEnd + fadeDuration);

  const { settings, updateSetting } = useSimulation();
  const [opacity, setOpacity] = useState<number>(0);
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const computeOpacity = (frame: number): number => {
      if (frame < effFadeInStart || frame > effFadeOutEnd) return 0;
      if (frame >= effFullStart && frame <= effFullEnd) return 1;
      if (frame < effFullStart) {
        const t = (frame - effFadeInStart) / (effFullStart - effFadeInStart);
        return Math.max(0, Math.min(1, t));
      } else {
        const t = (frame - effFullEnd) / (effFadeOutEnd - effFullEnd);
        return Math.max(0, Math.min(1, 1 - t));
      }
    };

    const handleFrameChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ frame: number }>;
      const frame = customEvent.detail?.frame;
      if (typeof frame === "number" && !isNaN(frame)) {
        setOpacity(computeOpacity(frame));
      }
    };

    window.addEventListener("scroll-frame-change", handleFrameChange);

    // Initial frame sync on mount
    if (typeof window !== "undefined") {
      const winFrame = (window as any).particlesCurrentFrame;
      if (typeof winFrame === "number" && !isNaN(winFrame)) {
        setOpacity(computeOpacity(winFrame));
      } else {
        const frameValEl = document.getElementById("overlay-frame-val");
        if (frameValEl) {
          const parsed = parseFloat(frameValEl.innerText);
          if (!isNaN(parsed)) {
            setOpacity(computeOpacity(parsed));
          }
        }
      }
    }

    return () => {
      window.removeEventListener("scroll-frame-change", handleFrameChange);
    };
  }, [effFadeInStart, effFullStart, effFullEnd, effFadeOutEnd]);

  // Forward wheel events over buttons to Lenis so scrolling on arrows doesn't stall
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (typeof window !== "undefined" && (window as any).lenis) {
      const lenis = (window as any).lenis;
      lenis.scrollTo(lenis.targetScroll + e.deltaY * 0.8, { immediate: true });
    }
  }, []);

  const projects = MODEL_NAMES;
  if (!projects.length) return null;

  const activeIndex = ((settings.currentModelIndex ?? 0) % projects.length + projects.length) % projects.length;

  const handleSelect = (index: number) => updateSetting("currentModelIndex", index);
  const handlePrev = () => handleSelect((activeIndex - 1 + projects.length) % projects.length);
  const handleNext = () => handleSelect((activeIndex + 1) % projects.length);

  const isInteractive = opacity > 0.02;
  const scale = 0.9 + 0.1 * opacity;

  // ── Dynamic measurement & responsive layout ──
  const offsets = projects.length === 1 ? [0] : [-2, -1, 0, 1, 2];
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [measuredWidths, setMeasuredWidths] = useState<Record<number, number>>({});
  const [measuredHeight, setMeasuredHeight] = useState<number>(24);

  // Measure actual rendered widths using ResizeObserver so any font size change recalculates spacing
  useEffect(() => {
    const updateMeasurements = () => {
      const nextWidths: Record<number, number> = {};
      let maxH = 24;
      offsets.forEach((offset) => {
        const el = itemRefs.current[offset];
        if (el) {
          const rect = el.getBoundingClientRect();
          const w = Math.ceil(rect.width);
          const h = Math.ceil(rect.height);
          if (w > 0) nextWidths[offset] = w;
          if (h > maxH) maxH = h;
        }
      });

      setMeasuredHeight(maxH);
      setMeasuredWidths((prev) => {
        const hasDiff = offsets.some((off) => prev[off] !== nextWidths[off]);
        return hasDiff ? nextWidths : prev;
      });
    };

    updateMeasurements();

    const ro = new ResizeObserver(updateMeasurements);
    offsets.forEach((offset) => {
      const el = itemRefs.current[offset];
      if (el) ro.observe(el);
    });

    window.addEventListener("resize", updateMeasurements);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [activeIndex, projects]);

  // Gap adapts proportionally to font size (measured height)
  const gap = Math.max(10, Math.round(measuredHeight * 0.0));

  const itemWidths: Record<number, number> = {};
  offsets.forEach((offset) => {
    const targetIndex = (activeIndex + offset + projects.length * 100) % projects.length;
    itemWidths[offset] =
      measuredWidths[offset] || getItemWidth(projects[targetIndex], windowWidth);
  });

  const xOffsets: Record<number, number> = { 0: 0 };
  if (itemWidths[1] !== undefined) {
    xOffsets[1] = (itemWidths[0] + itemWidths[1]) / 2 + gap;
  }
  if (itemWidths[2] !== undefined && itemWidths[1] !== undefined) {
    xOffsets[2] = xOffsets[1] + (itemWidths[1] + itemWidths[2]) / 2 + gap;
  }
  if (itemWidths[-1] !== undefined) {
    xOffsets[-1] = -((itemWidths[0] + itemWidths[-1]) / 2 + gap);
  }
  if (itemWidths[-2] !== undefined && itemWidths[-1] !== undefined) {
    xOffsets[-2] = xOffsets[-1] - ((itemWidths[-1] + itemWidths[-2]) / 2 + gap);
  }

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
        className="group relative p-2 md:p-3 text-white/80 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
      >
        <MinimalArrowLeft className="w-14 h-5 md:w-20 md:h-7 transition-all duration-300 group-hover:-translate-x-1.5 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
      </button>

      {/* ── Bottom HUD Title Menu ── */}
      <div
        onWheel={handleWheel}
        className="absolute left-0 right-0 bottom-8 sm:bottom-14 flex items-center justify-center pointer-events-none px-4"
      >
        <div
          className="relative w-full max-w-xs sm:max-w-xl md:max-w-3xl flex items-center justify-center overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]"
          style={{ minHeight: `${Math.max(44, measuredHeight + 16)}px` }}
        >
          {offsets.map((offset) => {
            const targetIndex = (activeIndex + offset + projects.length * 100) % projects.length;
            const title = projects[targetIndex];
            const isActive = offset === 0;
            const distance = Math.abs(offset);

            // Dynamic horizontal offset relative to center with measured gap
            const xOffset = xOffsets[offset] ?? 0;

            // Opacity: 1 for active center, 0.85 for distance 1 (gradient text handles falloff), 0 for distance >= 2
            let itemOpacity = 0;
            if (distance === 0) itemOpacity = 1;
            else if (distance === 1) itemOpacity = 0.85;

            // Gradient fade styling for unselected titles
            let titleStyle: React.CSSProperties = {
              letterSpacing: "0.03em",
            };

            if (isActive) {
              titleStyle = {
                ...titleStyle,
                color: "#ffffff",
                filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))",
              };
            } else if (offset < 0) {
              // Left side titles: opacity fades out towards the left
              titleStyle = {
                ...titleStyle,
                background:
                  distance === 1
                    ? "linear-gradient(to right, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.55) 100%)"
                    : "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              };
            } else {
              // Right side titles: opacity fades out towards the right
              titleStyle = {
                ...titleStyle,
                background:
                  distance === 1
                    ? "linear-gradient(to right, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 100%)"
                    : "linear-gradient(to right, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              };
            }

            return (
              <div
                key={offset}
                className="group absolute left-1/2 top-1/2 flex items-center justify-center cursor-pointer transition-all duration-200 hover:opacity-100"
                style={{
                  transform: `translate(calc(-50% + ${xOffset}px), -50%)`,
                  opacity: itemOpacity,
                  pointerEvents: isInteractive && itemOpacity > 0 ? "auto" : "none",
                }}
                onClick={() => (isActive ? undefined : handleSelect(targetIndex))}
                title={isActive ? title : `Switch to ${title}`}
              >
                <div
                  ref={(el) => {
                    itemRefs.current[offset] = el;
                  }}
                  className="relative py-1 px-2 sm:px-3 flex items-center justify-center whitespace-nowrap"
                >
                  <ScrambleTitle
                    title={title}
                    fontSize="clamp(13px, 18px, 57px)"
                    uppercase={false}
                    scrambleOnHover={true}
                    style={titleStyle}
                    triggerKey={activeIndex}
                    scrambleOptions={{
                      scrambleOnMount: false,
                      animateOnChange: true, // triggers shuffle animation when model changes
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Navigation Arrow */}
      <button
        onClick={handleNext}
        onWheel={handleWheel}
        aria-label="Next Project"
        title="Next Project"
        style={{ pointerEvents: isInteractive ? "auto" : "none" }}
        className="group relative p-2 md:p-3 text-white/80 hover:text-white transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
      >
        <MinimalArrowRight className="w-14 h-5 md:w-20 md:h-7 transition-all duration-300 group-hover:translate-x-1.5 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
      </button>
    </div>
  );
};
