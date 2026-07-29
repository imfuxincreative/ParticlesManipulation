"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { CALLOUT_TARGETS, CalloutTargetConfig } from "@/config/targetConfig";
import { SVGCalloutLine, getLabelPosition } from "./SVGCalloutLine";
import { CalloutLabel } from "./CalloutLabel";

/**
 * CalloutOverlaySystem
 *
 * Pure DOM component mounted OUTSIDE the R3F Canvas.
 * Listens to two CustomEvents:
 *   1. "target-positions-update" — screen-space positions from TargetOverlayBridge
 *   2. "scroll-frame-change"     — current Blender frame from LenisScrollAdapter
 *
 * Renders SVG callout lines + labels for each visible target.
 */

interface TargetScreenPositions {
  [targetId: string]: { x: number; y: number };
}

export const CalloutOverlaySystem: React.FC = () => {
  const [positions, setPositions] = useState<TargetScreenPositions>({});
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [svgScale, setSvgScale] = useState<number>(1);
  const positionsRef = useRef<TargetScreenPositions>({});
  const frameRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const dirtyRef = useRef(false);

  // Responsive SVG scale: full size on desktop, shrink on mobile
  useEffect(() => {
    const computeScale = () => {
      const w = window.innerWidth;
      if (w >= 768) return 1.0;
      // Linear scale: 768px → 1.0, 320px → 0.45
      return Math.max(0.45, 0.45 + (w - 320) * (0.55 / (768 - 320)));
    };

    setSvgScale(computeScale());

    const handleResize = () => setSvgScale(computeScale());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Batch updates via rAF to avoid re-rendering on every R3F frame (60fps+)
  const scheduleUpdate = useCallback(() => {
    if (dirtyRef.current) return;
    dirtyRef.current = true;

    rafIdRef.current = requestAnimationFrame(() => {
      dirtyRef.current = false;
      setPositions({ ...positionsRef.current });
      setCurrentFrame(frameRef.current);
    });
  }, []);

  useEffect(() => {
    const handlePositions = (e: Event) => {
      const customEvent = e as CustomEvent<TargetScreenPositions>;
      positionsRef.current = customEvent.detail;
      scheduleUpdate();
    };

    const handleFrame = (e: Event) => {
      const customEvent = e as CustomEvent<{ frame: number; offset: number }>;
      frameRef.current = customEvent.detail.frame;
      scheduleUpdate();
    };

    window.addEventListener("target-positions-update", handlePositions);
    window.addEventListener("scroll-frame-change", handleFrame);

    return () => {
      window.removeEventListener("target-positions-update", handlePositions);
      window.removeEventListener("scroll-frame-change", handleFrame);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [scheduleUpdate]);

  // Determine visibility for each target based on current frame
  const getVisibility = (config: CalloutTargetConfig): boolean => {
    return currentFrame >= config.frameStart && currentFrame <= config.frameEnd;
  };

  return (
    <div
      className="callout-overlay-system"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 35,
        overflow: "hidden",
      }}
    >
      {/* Full-viewport SVG layer for all callout lines */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {CALLOUT_TARGETS.map((config) => {
          const pos = positions[config.id];
          if (!pos) return null;

          return (
            <SVGCalloutLine
              key={config.id}
              anchorX={pos.x}
              anchorY={pos.y}
              config={config}
              visible={getVisibility(config)}
              scale={svgScale}
            />
          );
        })}
      </svg>

      {/* HTML label layer */}
      {CALLOUT_TARGETS.map((config) => {
        const pos = positions[config.id];
        if (!pos) return null;

        const labelPos = getLabelPosition(pos.x, pos.y, config, svgScale);
        const visible = getVisibility(config);

        return (
          <CalloutLabel
            key={config.id}
            x={labelPos.x}
            y={labelPos.y}
            config={config}
            visible={visible}
          />
        );
      })}
    </div>
  );
};
