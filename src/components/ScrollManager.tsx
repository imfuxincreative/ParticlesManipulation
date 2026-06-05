"use client";

import React, { useEffect } from "react";
import Lenis from "lenis";
import { useSimulation } from "@/context/SimulationContext";

export const ScrollManager: React.FC = () => {
  const { setScrollPercent } = useSimulation();

  useEffect(() => {
    // Initialize Lenis for smooth momentum scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });

    let animationFrameId: number;

    const raf = (time: number) => {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    };

    animationFrameId = requestAnimationFrame(raf);

    // Track scroll events — only compute the percentage.
    // Video seeking is handled inside ParticleLandscape's useFrame
    // so that seeking and texture upload stay in the same render tick.
    lenis.on("scroll", (e) => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const percent = Math.max(0, Math.min(1, e.scroll / scrollHeight));
      setScrollPercent(percent);
    });

    // Make sure we update size/scroll heights on resize
    const handleResize = () => {
      lenis.resize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
      window.removeEventListener("resize", handleResize);
    };
  }, [setScrollPercent]);

  return (
    // Create a scroll track using a tall empty spacer element to allow page scrolling
    <div className="w-full h-[500vh] pointer-events-none z-10" />
  );
};
