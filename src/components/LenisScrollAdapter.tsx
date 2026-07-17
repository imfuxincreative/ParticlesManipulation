"use client";

import React, { useEffect, useRef } from "react";
import { useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import Lenis from "lenis";

export const LenisScrollAdapter: React.FC = () => {
  const scroll = useScroll();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!scroll || !scroll.el) return;

    const wrapper = scroll.el;
    const content = scroll.el.firstElementChild as HTMLElement;

    if (!wrapper || !content) return;

    // Configure Lenis to smooth out both mouse wheel and mobile touch gestures
    // syncTouch: true replaces the browser's native touch scrolling with Lenis interpolation,
    // which prevents the touch delta compounding that makes repeated swipes scroll too fast.
    const lenis = new Lenis({
      wrapper: wrapper,
      content: content,
      eventsTarget: wrapper,
      duration: 1.6, // Slower duration for a premium, heavy feel (like igloo.inc / jaam)
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo curve
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      syncTouch: true, // Crucial: Hijack native mobile momentum scroll
      syncTouchLerp: 0.05, // Lower factor (e.g. 0.05) creates a slower, extremely smooth touch response
      touchMultiplier: 0.65, // Limit speed of swipes to prevent fast spinning
      wheelMultiplier: 0.8, // Elegant, controlled wheel scrolling
    });

    lenisRef.current = lenis;

    // Dynamically adjust Lenis size when page layout or number of pages changes
    const resizeObserver = new ResizeObserver(() => {
      lenis.resize();
    });
    
    resizeObserver.observe(wrapper);
    if (content) {
      resizeObserver.observe(content);
    }

    return () => {
      resizeObserver.disconnect();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [scroll]);

  // Tick Lenis physics in R3F frame loop so that it updates smoothly before R3F renders
  useFrame((state) => {
    if (lenisRef.current) {
      const lenis = lenisRef.current;

      // Prevent scroll target from running too far ahead of the current position.
      // This acts as a velocity governor: no matter how fast or repeatedly the user swipes,
      // the scroll animation target is capped to a fraction of the viewport height.
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
      const capMultiplier = isMobile ? 0.45 : 0.8; // Stricter cap (45% of viewport height) on mobile
      const maxDistance = typeof window !== "undefined" ? window.innerHeight * capMultiplier : 600;

      const diff = lenis.targetScroll - lenis.scroll;
      if (Math.abs(diff) > maxDistance) {
        lenis.targetScroll = lenis.scroll + Math.sign(diff) * maxDistance;
      }

      // Lenis raf requires elapsed time in milliseconds
      lenis.raf(state.clock.getElapsedTime() * 1000);
    }
  });

  return null;
};
