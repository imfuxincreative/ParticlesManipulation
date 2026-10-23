"use client";

import React, { useState, useEffect } from "react";
import { useLoopTransition } from "./transitionConfig";
import { useAtmosphere, deriveFogColorHex } from "@/lib/atmosphere";

/**
 * LoopTransitionOverlay
 *
 * Full-screen hardware-accelerated UI overlay that creates a pure,
 * luminous scene blur and atmospheric color mist dissolve during the loop
 * transition between first and last frame.
 *
 * When the screen dissolves into full red, displays a plain <p> tag in the
 * center of the screen with a typewriter typing animation: "to be continued".
 */
// Sub-component for typing animation, ensuring hooks are isolated and never called conditionally
const ToBeContinuedText: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const fullText = (text || "to be continued").toLowerCase();

  // Typing animation: reveals characters one by one
  useEffect(() => {
    let currentIndex = 0;
    setDisplayedText("");

    const typingTimer = setInterval(() => {
      currentIndex++;
      if (currentIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex));
      } else {
        clearInterval(typingTimer);
      }
    }, 90);

    return () => clearInterval(typingTimer);
  }, [fullText]);

  // Blinking cursor animation
  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 text-center select-none pointer-events-none z-30">
      <p
        id="to-be-continued-text"
        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl text-white font-mono tracking-[0.2em] font-normal lowercase select-none m-0"
        style={{
          textShadow: "0 2px 24px rgba(0, 0, 0, 0.45)",
        }}
      >
        {displayedText}
        <span
          className={`inline-block ml-1 font-light ${
            showCursor ? "opacity-100" : "opacity-0"
          } transition-opacity duration-75`}
          aria-hidden="true"
        >
          |
        </span>
      </p>
    </div>
  );
};

export const LoopTransitionOverlay: React.FC = () => {
  const isTransitioning = useLoopTransition((s) => s.isTransitioning);
  const transitionProgress = useLoopTransition((s) => s.transitionProgress);
  const activeScene = useLoopTransition((s) => s.activeScene);
  const config = useLoopTransition((s) => s.config);

  const horizonColor = useAtmosphere((s) => s.horizonColor);
  const zenithColor = useAtmosphere((s) => s.zenithColor);
  const decoupleFog = useAtmosphere((s) => s.decoupleFog);
  const fogColorOverride = useAtmosphere((s) => s.fogColorOverride);

  const isInTouch = activeScene === "inTouch";

  // Zero-cost fast path during normal timeline scrolling
  if (!isInTouch && !isTransitioning && transitionProgress <= 0.001) {
    return null;
  }

  const p = Math.max(0, Math.min(1, transitionProgress));
  const maxBlur = config.maxBlurPx ?? 64;

  let blurPx: string;
  let mistOpacity: number;
  let contrast: string;
  let brightness: string;
  let saturation: string;

  if (isInTouch) {
    if (isTransitioning) {
      // Transitioning into or out of inTouch:
      // p = 1.0 -> full mist (1.0) and max blur (64px) matching main scene peak
      // p = 0.0 -> glass mist (0.32) and frosted blur (28px)
      const curBlur = 28.0 + (maxBlur - 28.0) * p;
      blurPx = curBlur.toFixed(1);
      mistOpacity = 0.32 + (1.0 - 0.32) * Math.pow(p, 1.15);
      contrast = (1.32 + (0.12 - 1.32) * p).toFixed(3);
      brightness = (1.02 + (1.16 - 1.02) * p).toFixed(3);
      saturation = (1.25 + (1.28 - 1.25) * p).toFixed(3);
    } else {
      // Resting in inTouch: frosted glass aesthetic matching Image 1
      blurPx = "28.0";
      mistOpacity = 0.32;
      contrast = "1.32";
      brightness = "1.02";
      saturation = "1.25";
    }
  } else {
    // In main scene (Scene 1):
    // p = 0.0 -> clean normal timeline view
    // p = 1.0 -> full atmospheric red mist and blur matching inTouch peak
    blurPx = (p * maxBlur).toFixed(1);
    mistOpacity = p <= 0.02 ? 0 : Math.min(1.0, Math.pow(p, 1.15));
    contrast = (1.0 - p * 0.88).toFixed(3);
    brightness = (1.0 + p * 0.16).toFixed(3);
    saturation = (1.0 + p * 0.28).toFixed(3);
  }

  // Atmospheric fog color hex
  const fogColor = deriveFogColorHex({
    horizonColor,
    zenithColor,
    decoupleFog,
    fogColorOverride,
  });

  // Typewriter effect state for plain <p> "to be continued" (only if explicitly enabled in config)
  const isEnabled = config.showToBeContinued === true;
  const isTypingActive = !isInTouch && isTransitioning && isEnabled && p >= 0.7;

  return (
    <div
      id="loop-transition-overlay"
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-25 overflow-hidden"
      style={{
        backdropFilter: `blur(${blurPx}px) contrast(${contrast}) brightness(calc(${brightness} * var(--broken-light-mult, 1))) saturate(${saturation})`,
        WebkitBackdropFilter: `blur(${blurPx}px) contrast(${contrast}) brightness(calc(${brightness} * var(--broken-light-mult, 1))) saturate(${saturation})`,
        willChange: "backdrop-filter, opacity",
      }}
      aria-hidden={!isTypingActive}
    >
      {/* Radiant atmospheric mist veil that smoothly envelopes the viewport into the sky colors */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${zenithColor} 0%, ${fogColor} 50%, ${horizonColor} 100%)`,
          opacity: `calc(${mistOpacity} * var(--broken-light-mult, 1))`,
          willChange: "opacity",
        }}
      />
      {/* Subtle optical core bloom to give deep ethereal glow */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${horizonColor}99 0%, transparent 70%)`,
          opacity: `calc(${isInTouch ? 0.22 : mistOpacity * 0.5} * var(--broken-light-mult, 1))`,
          mixBlendMode: "screen",
          willChange: "opacity",
        }}
      />

      {/* Centered plain <p> tag with typing animation */}
      {isTypingActive && (
        <ToBeContinuedText text={config.toBeContinuedText || "to be continued"} />
      )}
    </div>
  );
};

