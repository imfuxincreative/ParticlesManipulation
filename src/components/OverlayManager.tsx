"use client";

import React, { useState, useEffect } from "react";
import { ProjectsController } from "./ProjectsController";
import HaveASeat from "./HaveASeat";

// --- REUSABLE FRAME OVERLAY WRAPPER ---
// Automatically handles frame synchronization, fade-in/out transitions,
// and pointer-events toggling so invisible overlays never block 3D or UI interaction.
export interface FrameOverlayProps {
  startFrame: number;
  endFrame: number;
  children: React.ReactNode;
  className?: string;
  fadeDuration?: number; // CSS transition duration in ms (default: 400ms)
}

export const FrameOverlay: React.FC<FrameOverlayProps> = ({
  startFrame,
  endFrame,
  children,
  className = "",
  fadeDuration = 400,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkFrame = (frame: number) => {
      const inRange = frame >= startFrame && frame <= endFrame;
      setIsVisible(inRange);
    };

    const handleFrameChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ frame: number }>;
      const frame = customEvent.detail?.frame;
      if (typeof frame === "number" && !isNaN(frame)) {
        checkFrame(frame);
      }
    };

    window.addEventListener("scroll-frame-change", handleFrameChange);

    // Initial check on mount in case the page reloaded at this scroll position
    if (typeof window !== "undefined") {
      const winFrame = (window as any).particlesCurrentFrame;
      if (typeof winFrame === "number" && !isNaN(winFrame)) {
        checkFrame(winFrame);
      } else {
        const frameValEl = document.getElementById("overlay-frame-val");
        if (frameValEl) {
          const frame = parseFloat(frameValEl.innerText);
          if (!isNaN(frame)) {
            checkFrame(frame);
          }
        }
      }
    }

    return () => window.removeEventListener("scroll-frame-change", handleFrameChange);
  }, [startFrame, endFrame]);

  return (
    <div
      className={`fixed inset-0 pointer-events-none select-none transition-opacity ease-in-out z-35 ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        } ${className}`}
      style={{ transitionDuration: `${fadeDuration}ms` }}
    >
      {children}
    </div>
  );
};

// --- SCALABLE OVERLAY REGISTRY ---
// Easily add, remove, or modify overlays here with start and end frames.
export interface OverlayConfig {
  id: string;
  startFrame: number;
  endFrame: number;
  component: React.ReactNode;
  className?: string;
  fadeDuration?: number;
}

export const OVERLAY_CONFIGS: OverlayConfig[] = [
  {
    id: "projects-ui",
    startFrame: 7435,
    endFrame: 7800,
    component: <ProjectsController startFrame={7435} endFrame={7800} />,
  },
  // Future overlays can be registered here:
  // {
  //   id: "contact-have-a-seat",
  //   startFrame: 4057,
  //   endFrame: 4561,
  //   component: <HaveASeat />,
  // },
];

// --- OVERLAY MANAGER ---
export const OverlayManager: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-30">
      {OVERLAY_CONFIGS.map((overlay) => (
        <FrameOverlay
          key={overlay.id}
          startFrame={overlay.startFrame}
          endFrame={overlay.endFrame}
          className={overlay.className}
          fadeDuration={overlay.fadeDuration}
        >
          {overlay.component}
        </FrameOverlay>
      ))}
    </div>
  );
};
