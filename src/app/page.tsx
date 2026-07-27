"use client";

import React from "react";
import dynamic from "next/dynamic";
import { SimulationProvider } from "@/context/SimulationContext";
import { Dashboard } from "@/components/Dashboard";

// Disable SSR for 3D R3F Canvas to prevent hydration errors and canvas initialization issues
const SceneContainer = dynamic(
  () => import("@/components/SceneContainer").then((mod) => mod.SceneContainer),
  { ssr: false }
);

const ParticleLoadingScreen = dynamic(
  () => import("@/components/ParticleLoadingScreen").then((mod) => mod.ParticleLoadingScreen),
  { ssr: false }
);

const OverlayManager = dynamic(
  () => import("@/components/OverlayManager").then((mod) => mod.OverlayManager),
  { ssr: false }
);

const CalloutOverlaySystem = dynamic(
  () => import("@/components/callouts/CalloutOverlaySystem").then((mod) => mod.CalloutOverlaySystem),
  { ssr: false }
);

export default function Home() {
  return (
    <SimulationProvider>
      <main className="relative w-full min-h-screen bg-slate-950">
        
        {/* React Three Fiber Canvas Background */}
        <div className="fixed inset-0 w-full h-full z-0">
          <SceneContainer />
        </div>

        {/* Dynamic Timeline Frame-Based Overlays */}
        <OverlayManager />

        {/* 3D-anchored SVG Callout Overlay System */}
        <CalloutOverlaySystem />

        {/* Dashboard HUD Controls & Text Overlay */}
        <Dashboard />

        {/* Particle Loading Screen Overlay — always visible during development */}
        <ParticleLoadingScreen />
        
      </main>
    </SimulationProvider>
  );
}
