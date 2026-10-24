"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSimulation } from "@/context/SimulationContext";
import { MODEL_NAMES } from "@/config/projectModels";
import { ScrambleTitle } from "./ui/ScrambleTitle";

// Custom hook to trigger random 2 to 4 opacity glitch flickers
function useArrowGlitch(visible: boolean) {
  const [opacity, setOpacity] = useState(0);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const runGlitch = useCallback((targetVisible: boolean) => {
    clearAllTimers();
    // 2 to 4 random flickers
    const flickers = Math.floor(Math.random() * 3) + 2;
    let time = 0;

    for (let i = 0; i < flickers; i++) {
      // Off / dim step
      const offDuration = Math.floor(Math.random() * 35) + 25;
      time += offDuration;
      const t1 = setTimeout(() => {
        setOpacity(Math.random() < 0.6 ? 0 : 0.2);
      }, time);
      timersRef.current.push(t1);

      // On / bright step
      const onDuration = Math.floor(Math.random() * 45) + 30;
      time += onDuration;
      const t2 = setTimeout(() => {
        setOpacity(Math.random() < 0.3 ? 0.7 : 1);
      }, time);
      timersRef.current.push(t2);
    }

    // Final settle
    const finalT = setTimeout(() => {
      setOpacity(targetVisible ? 1 : 0);
    }, time + 30);
    timersRef.current.push(finalT);
  }, []);

  const prevVisibleRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevVisibleRef.current === null) {
      prevVisibleRef.current = visible;
      if (visible) {
        runGlitch(true);
      } else {
        setOpacity(0);
      }
      return;
    }

    if (visible !== prevVisibleRef.current) {
      prevVisibleRef.current = visible;
      runGlitch(visible);
    }
  }, [visible, runGlitch]);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const triggerFlicker = useCallback(() => {
    if (!visible) return;
    runGlitch(true);
  }, [visible, runGlitch]);

  return { opacity, triggerFlicker };
}

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
}) => {
  const effStart = startFrame ?? targetFrame ?? 7435;
  const effEnd = endFrame ?? targetFrame ?? 7800;

  const { settings, updateSetting } = useSimulation();
  const [isInRange, setIsInRange] = useState<boolean>(false);

  const leftArrow = useArrowGlitch(isInRange);
  const rightArrow = useArrowGlitch(isInRange);

  useEffect(() => {
    const checkFrame = (frame: number) => {
      const inRange = frame >= effStart && frame <= effEnd;
      setIsInRange(inRange);
    };

    const handleFrameChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ frame: number }>;
      const frame = customEvent.detail?.frame;
      if (typeof frame === "number" && !isNaN(frame)) {
        checkFrame(frame);
      }
    };

    window.addEventListener("scroll-frame-change", handleFrameChange);

    // Initial sync on mount
    if (typeof window !== "undefined") {
      const winFrame = (window as any).particlesCurrentFrame;
      if (typeof winFrame === "number" && !isNaN(winFrame)) {
        checkFrame(winFrame);
      } else {
        const frameValEl = document.getElementById("overlay-frame-val");
        if (frameValEl) {
          const parsed = parseFloat(frameValEl.innerText);
          if (!isNaN(parsed)) {
            checkFrame(parsed);
          }
        }
      }
    }

    return () => {
      window.removeEventListener("scroll-frame-change", handleFrameChange);
    };
  }, [effStart, effEnd]);

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

  // Simple, robust layout: show [previous, active, next] titles with flex gap
  const offsets = projects.length === 1 ? [0] : [-1, 0, 1];

  return (
    <div className="fixed inset-0 z-40 pointer-events-none select-none">
      {/* Navigation Arrows: edge-to-edge on mobile, narrower gap on desktop */}
      <div className="w-full h-full max-w-full md:max-w-2xl lg:max-w-3xl mx-auto flex items-center justify-between  md:px-2 pointer-events-none">
        {/* Left Navigation Arrow */}
        <button
          onClick={() => {
            leftArrow.triggerFlicker();
            handlePrev();
          }}
          onMouseEnter={leftArrow.triggerFlicker}
          onWheel={handleWheel}
          aria-label="Previous Project"
          title="Previous Project"
          style={{
            opacity: leftArrow.opacity,
            pointerEvents: isInRange ? "auto" : "none",
          }}
          className="group relative w-20 h-14 sm:w-24 sm:h-16 md:w-28 md:h-16 flex items-center justify-center text-white/80 hover:text-white cursor-pointer select-none transition-colors duration-150"
        >
          <MinimalArrowLeft className="pointer-events-none w-14 h-5 md:w-20 md:h-7 transition-transform duration-200 group-hover:-translate-x-1.5 group-active:scale-95 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
        </button>

        {/* Right Navigation Arrow */}
        <button
          onClick={() => {
            rightArrow.triggerFlicker();
            handleNext();
          }}
          onMouseEnter={rightArrow.triggerFlicker}
          onWheel={handleWheel}
          aria-label="Next Project"
          title="Next Project"
          style={{
            opacity: rightArrow.opacity,
            pointerEvents: isInRange ? "auto" : "none",
          }}
          className="group relative w-20 h-14 sm:w-24 sm:h-16 md:w-28 md:h-16 flex items-center justify-center text-white/80 hover:text-white cursor-pointer select-none transition-colors duration-150"
        >
          <MinimalArrowRight className="pointer-events-none w-14 h-5 md:w-20 md:h-7 transition-transform duration-200 group-hover:translate-x-1.5 group-active:scale-95 group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" />
        </button>
      </div>

      {/* ── Bottom HUD Title Menu ── */}
      <div
        onWheel={handleWheel}
        className="absolute left-0 right-0 bottom-8 sm:bottom-14 flex items-center justify-center pointer-events-none px-4"
      >
        <div className="flex items-center justify-center gap-6 sm:gap-8">
          {offsets.map((offset) => {
            const targetIndex = (activeIndex + offset + projects.length * 100) % projects.length;
            const title = projects[targetIndex];
            const isActive = offset === 0;

            let titleStyle: React.CSSProperties = {
              fontSize: "16px",
              textTransform: "uppercase",
              lineHeight: "1.2",
              fontFamily: "var(--font-satoshi)",
              letterSpacing: "0.1px",
              display: "inline-flex",
              alignItems: "center",
              verticalAlign: "middle",
            };

            if (isActive) {
              titleStyle = {
                ...titleStyle,
                color: "#ffffff",
                opacity: 1,
                filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))",
              };
            } else if (offset < 0) {
              // Left side titles: opacity fades out towards the left
              titleStyle = {
                ...titleStyle,
                background:
                  "linear-gradient(to right, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.65) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              };
            } else {
              // Right side titles: opacity fades out towards the right
              titleStyle = {
                ...titleStyle,
                background:
                  "linear-gradient(to right, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.15) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              };
            }

            return (
              <div
                key={offset}
                className="group flex items-center justify-center cursor-pointer transition-opacity duration-200 hover:brightness-125"
                style={{
                  pointerEvents: isInRange ? "auto" : "none",
                }}
                onClick={() => (isActive ? undefined : handleSelect(targetIndex))}
                title={isActive ? title : `Switch to ${title}`}
              >
                <div className="relative py-1 px-2 flex items-center justify-center whitespace-nowrap">
                  <h5 className="inline-flex items-center justify-center" style={titleStyle}>
                    <ScrambleTitle
                      title={title}
                      visible={isInRange}
                      triggerKey={activeIndex}
                    />
                  </h5>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
