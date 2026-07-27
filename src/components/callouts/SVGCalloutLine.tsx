"use client";

import React from "react";
import type { CalloutTargetConfig } from "@/config/targetConfig";

/**
 * SVGCalloutLine
 *
 * Renders an L-shaped callout line matching the reference design:
 *   • Small dot at the 3D anchor point
 *   • Diagonal segment going up-left or up-right
 *   • Horizontal segment extending to the label
 *   • Stroke-dashoffset draw-in / draw-out animation
 */
interface SVGCalloutLineProps {
  /** Screen-space X of the 3D anchor point */
  anchorX: number;
  /** Screen-space Y of the 3D anchor point */
  anchorY: number;
  /** Target config for line geometry */
  config: CalloutTargetConfig;
  /** Whether the line should be drawn (true) or hidden (false) */
  visible: boolean;
}

export const SVGCalloutLine: React.FC<SVGCalloutLineProps> = ({
  anchorX,
  anchorY,
  config,
  visible,
}) => {
  const diagonalLength = config.diagonalLength ?? 80;
  const horizontalLength = config.horizontalLength ?? 120;
  const diagonalAngle = config.diagonalAngle ?? 35;
  const direction = config.direction;
  const color = config.accentColor ?? "rgba(255, 255, 255, 0.85)";

  // Compute the diagonal endpoint
  // Direction multiplier: left = -1, right = +1 for X axis
  const dirX = direction === "left" ? -1 : 1;
  const angleRad = (diagonalAngle * Math.PI) / 180;

  // Diagonal goes UP (negative Y) and LEFT/RIGHT (dirX)
  const diagEndX = anchorX + dirX * Math.sin(angleRad) * diagonalLength;
  const diagEndY = anchorY - Math.cos(angleRad) * diagonalLength;

  // Horizontal extends further in the same direction
  const horizEndX = diagEndX + dirX * horizontalLength;
  const horizEndY = diagEndY; // same Y — perfectly horizontal

  // SVG path: M anchor → L diagonal end → L horizontal end
  const pathD = `M ${anchorX} ${anchorY} L ${diagEndX} ${diagEndY} L ${horizEndX} ${horizEndY}`;

  return (
    <>
      {/* Main line path with draw-in/draw-out animation.
          pathLength="1" normalizes the total length to 1 regardless of actual geometry,
          so dasharray/dashoffset stay fixed at 0 or 1 and the CSS transition is never
          interrupted by position updates during scrolling. */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={visible ? 0 : 1}
        style={{
          transition: visible
            ? "stroke-dashoffset 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
            : "stroke-dashoffset 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53)",
          filter: "drop-shadow(0 0 3px rgba(255,255,255,0.15))",
        }}
      />

      {/* Small anchor dot at the 3D target point */}
      <circle
        cx={anchorX}
        cy={anchorY}
        r={2}
        fill={color}
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.4s ease",
          filter: "drop-shadow(0 0 4px rgba(255,255,255,0.3))",
        }}
      />

      {/* Tiny diamond marker at the diagonal→horizontal joint */}
      <polygon
        points={`${diagEndX},${diagEndY - 3} ${diagEndX + 3},${diagEndY} ${diagEndX},${diagEndY + 3} ${diagEndX - 3},${diagEndY}`}
        fill={color}
        style={{
          opacity: visible ? 0.7 : 0,
          transition: "opacity 0.6s ease 0.2s",
        }}
      />
    </>
  );
};

/**
 * Computes the label anchor position (where the label should be placed).
 * Returns the endpoint of the horizontal segment.
 */
export function getLabelPosition(
  anchorX: number,
  anchorY: number,
  config: CalloutTargetConfig
): { x: number; y: number } {
  const diagonalLength = config.diagonalLength ?? 80;
  const horizontalLength = config.horizontalLength ?? 120;
  const diagonalAngle = config.diagonalAngle ?? 35;
  const dirX = config.direction === "left" ? -1 : 1;
  const angleRad = (diagonalAngle * Math.PI) / 180;

  const diagEndX = anchorX + dirX * Math.sin(angleRad) * diagonalLength;
  const diagEndY = anchorY - Math.cos(angleRad) * diagonalLength;
  const horizEndX = diagEndX + dirX * horizontalLength;

  return { x: horizEndX, y: diagEndY };
}
