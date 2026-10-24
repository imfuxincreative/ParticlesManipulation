"use client";

import React from "react";
import { useTextScramble } from "@/hooks/useTextScramble";

export interface ScrambleTitleProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The text to display and scramble */
  title?: string;
  text?: string;
  /** Controls appear / disappear typing + shuffle animation */
  visible?: boolean;
  /** Trigger text scramble on mouse hover (default: true) */
  scrambleOnHover?: boolean;
  /** Trigger key that triggers re-shuffle/type transition on change */
  triggerKey?: any;
  /** Speed in ms per tick (default: 26) */
  speed?: number;
  /** Scroll-driven progress (0.0 to 1.0) */
  progress?: number;
  /** Enable digital text shuffle sound effect (default: true) */
  enableSound?: boolean;
  /** Sound volume multiplier (0.0 to 1.0, default: 1.0) */
  soundVolume?: number;
}

export const ScrambleTitle: React.FC<ScrambleTitleProps> = ({
  title,
  text,
  visible = true,
  scrambleOnHover = true,
  triggerKey,
  speed = 26,
  progress,
  enableSound = true,
  soundVolume = 1.0,
  className = "",
  style,
  onMouseEnter,
  ...restProps
}) => {
  const content = title ?? text ?? "";
  const { displayText, triggerScramble } = useTextScramble(content, {
    visible,
    triggerKey,
    speed,
    progress,
    enableSound,
    soundVolume,
  });

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (scrambleOnHover) {
      triggerScramble();
    }
    onMouseEnter?.(e);
  };

  return (
    <span
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        verticalAlign: "middle",
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      {...restProps}
    >
      {/* Invisible anchor: locks exact settled width & height so text changes never push adjacent titles */}
      <span
        className="invisible select-none pointer-events-none whitespace-nowrap"
        aria-hidden="true"
      >
        {content}
      </span>

      {/* Visible animated text: overlays the anchor seamlessly */}
      <span className="absolute inset-0 flex items-center justify-center text-center whitespace-nowrap">
        {displayText}
      </span>
    </span>
  );
};

export default ScrambleTitle;
