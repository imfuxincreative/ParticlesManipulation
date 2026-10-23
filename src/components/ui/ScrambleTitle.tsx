"use client";

import React from "react";
import { useTextScramble, UseTextScrambleOptions } from "@/hooks/useTextScramble";

export interface ScrambleTitleProps extends React.HTMLAttributes<HTMLElement> {
  /** The text to display and scramble */
  title?: string;
  text?: string;
  /** Custom font size (e.g. "24px", "clamp(1.2rem, 3vw, 2rem)", 28) */
  fontSize?: string | number;
  /** HTML Tag to render as (default: "span") */
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div";
  /** Trigger text scramble on mouse hover (default: true) */
  scrambleOnHover?: boolean;
  /** Custom font family (defaults to var(--font-dirtyline)) */
  fontFamily?: string;
  /** Whether to transform text to uppercase (default: false) */
  uppercase?: boolean;
  /** Wrap in the slanted parallelogram badge border from Figma */
  slantedBox?: boolean;
  /** Optional trigger key that triggers a shuffle whenever it changes */
  triggerKey?: any;
  /** Scramble options (speed, character pool) */
  scrambleOptions?: UseTextScrambleOptions;
}

export const ScrambleTitle: React.FC<ScrambleTitleProps> = ({
  title,
  text,
  fontSize,
  as = "span",
  scrambleOnHover = true,
  fontFamily = "var(--font-dirtyline)",
  uppercase = false,
  slantedBox = false,
  triggerKey,
  scrambleOptions,
  className = "",
  style,
  onMouseEnter,
  ...restProps
}) => {
  const content = title ?? text ?? "";
  const { displayText, triggerScramble, isScrambling } = useTextScramble(
    content,
    {
      ...scrambleOptions,
      triggerKey: triggerKey ?? scrambleOptions?.triggerKey,
    }
  );

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (scrambleOnHover) {
      triggerScramble(content);
    }
    onMouseEnter?.(e);
  };

  const parsedFontSize =
    typeof fontSize === "number" ? `${fontSize}px` : fontSize;

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontSize: parsedFontSize,
    textTransform: uppercase ? "uppercase" : "none",
    letterSpacing: uppercase ? "0.06em" : "0.03em",
    lineHeight: 1.1,
    ...style,
  };

  const isGradient = Boolean(
    style?.WebkitBackgroundClip === "text" ||
    (style as any)?.backgroundClip === "text"
  );

  const Tag = as as any;

  const innerText = (
    <Tag
      style={textStyle}
      className={`inline-block select-none transition-all duration-200 ${isScrambling
          ? isGradient
            ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] brightness-125"
            : "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
          : ""
        } ${className}`}
      onMouseEnter={handleMouseEnter}
      {...restProps}
    >
      {displayText}
    </Tag>
  );

  // If slanted parallelogram box requested (matches Figma reference)
  if (slantedBox) {
    return (
      <div
        className="group relative inline-flex items-center justify-center cursor-pointer transform -skew-x-[14deg] border border-white/40 hover:border-white/80 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md px-2 py-2 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.06)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
        onMouseEnter={handleMouseEnter}
      >
        <div className="transform skew-x-[14deg] flex items-center justify-center">
          {innerText}
        </div>
      </div>
    );
  }

  return innerText;
};

export default ScrambleTitle;
