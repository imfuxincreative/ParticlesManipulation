"use client";

import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, ArrowUpRight } from "lucide-react";
import HaveASeat from "./HaveASeat";

// --- REUSABLE FRAME OVERLAY WRAPPER ---
// Listen to "scroll-frame-change" custom events from LenisScrollAdapter.
// Toggles visibility smoothly via CSS opacity and transform animations.
interface FrameOverlayProps {
  startFrame: number;
  endFrame: number;
  children: React.ReactNode;
  className?: string;
}

export const FrameOverlay: React.FC<FrameOverlayProps> = ({
  startFrame,
  endFrame,
  children,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleFrameChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ frame: number }>;
      const frame = customEvent.detail.frame;

      const inRange = frame >= startFrame && frame <= endFrame;
      if (inRange !== isVisible) {
        setIsVisible(inRange);
      }
    };

    window.addEventListener("scroll-frame-change", handleFrameChange);
    // Trigger check on mount in case we are already in the frame range
    const frameValEl = document.getElementById("overlay-frame-val");
    if (frameValEl) {
      const frame = parseFloat(frameValEl.innerText);
      if (!isNaN(frame)) {
        setIsVisible(frame >= startFrame && frame <= endFrame);
      }
    }

    return () => window.removeEventListener("scroll-frame-change", handleFrameChange);
  }, [startFrame, endFrame, isVisible]);

  return (
    <div
      className={`fixed inset-0 z-35 flex flex-col justify-between p-8 pointer-events-none select-none transition-all duration-1000 ease-in-out ${isVisible
        ? "opacity-100  pointer-events-auto"
        : "opacity-0  pointer-events-none"
        } ${className}`}
    >
      {children}
    </div>
  );
};


// --- SPECIFIC OVERLAY: TALK / HIRE ME (FRAME 3613 - 3783) ---



// --- OVERLAY MANAGER ---
// Mount your overlays here. Each overlay defines its range of frames.
export const OverlayManager: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-30">
      {/* Talk / Hire Overlay (Frame 3613 to 3783) */}
      {/* <FrameOverlay startFrame={3613} endFrame={3783}>
        <HaveASeat />
      </FrameOverlay> */}

      {/* You can easily add more frame-based overlays here in the future:
      <FrameOverlay startFrame={1000} endFrame={1500}>
        <AnotherOverlayComponent />
      </FrameOverlay>
      */}
    </div>
  );
};
