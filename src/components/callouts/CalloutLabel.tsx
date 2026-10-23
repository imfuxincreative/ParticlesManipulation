"use client";

import React from "react";
import type { CalloutTargetConfig } from "@/config/targetConfig";
import ScrambleTitle from "../ui/ScrambleTitle";

/**
 * CalloutLabel
 *
 * Monospace uppercase label positioned at the end of the SVG callout line.
 * Matches the reference design: primary label + optional sublabel,
 * clean technical/HUD aesthetic.
 */
interface CalloutLabelProps {
  /** Screen-space X of the label anchor (end of horizontal line) */
  x: number;
  /** Screen-space Y of the label anchor */
  y: number;
  /** Target config for text and direction */
  config: CalloutTargetConfig;
  /** Whether the label is visible */
  visible: boolean;
  /** Scroll-driven progress (0.0 to 1.0) */
  progress?: number;
}

export const CalloutLabel: React.FC<CalloutLabelProps> = ({
  x,
  y,
  config,
  visible,
  progress,
}) => {
  const isLeft = config.direction === "left";
  const color = config.accentColor ?? "rgba(255, 255, 255, 0.9)";

  const isScrollDriven = progress !== undefined;
  // Label starts revealing as horizontal line reaches out (from 35% to 100% of line draw)
  const labelProgress = isScrollDriven
    ? Math.max(0, Math.min(1, (progress - 0.35) / 0.65))
    : (visible ? 1 : 0);

  const labelOpacity = isScrollDriven ? Math.min(1, labelProgress * 2) : (visible ? 1 : 0);
  const isInteractive = isScrollDriven ? progress > 0.8 : visible;

  return (
    <div
      className="callout-label"
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        // Align label to the correct side of the line endpoint
        transform: isLeft
          ? "translate(-100%, -50%)"
          : "translate(0%, -50%)",
        // Add small gap from line end
        paddingLeft: isLeft ? 0 : 10,
        paddingRight: isLeft ? 10 : 0,
        pointerEvents: isInteractive ? "auto" : "none",
        opacity: labelOpacity,
        transition: isScrollDriven
          ? "none"
          : visible
          ? "opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.3s"
          : "opacity 0.3s ease",
        willChange: "opacity, transform",
      }}
    >
      <div
        style={{
          color,
          userSelect: "none",
          whiteSpace: "nowrap",
          textAlign: isLeft ? "right" : "left",
        }}
      >
        {/* Primary label */}
        <h3
          style={{
            fontSize: "12px",
            textTransform: "uppercase",
            lineHeight: "1.3",
          }}
        >
          <ScrambleTitle
            title={config.label}
            visible={isScrollDriven ? progress > 0.35 : visible}
            progress={isScrollDriven ? labelProgress : undefined}
          />
        </h3>

        {/* Sublabel */}
        {config.sublabel && (
          <h5
            style={{
              fontSize: "11px",
              color: color,
              textTransform: "uppercase",
              opacity: 0.65,
              lineHeight: "1.3",
              marginTop: "2px",
            }}
          >
            <ScrambleTitle
              title={config.sublabel}
              visible={isScrollDriven ? progress > 0.35 : visible}
              progress={isScrollDriven ? labelProgress : undefined}
            />
          </h5>
        )}
      </div>
    </div>
  );
};
