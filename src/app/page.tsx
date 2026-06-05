"use client";

import React from "react";
import dynamic from "next/dynamic";
import { SimulationProvider } from "@/context/SimulationContext";
import { ScrollManager } from "@/components/ScrollManager";
import { Dashboard } from "@/components/Dashboard";

// Disable SSR for 3D R3F Canvas to prevent hydration errors and canvas initialization issues
const SceneContainer = dynamic(
  () => import("@/components/SceneContainer").then((mod) => mod.SceneContainer),
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

        {/* Dashboard HUD Controls & Text Overlay */}
        <Dashboard />

        {/* Scroll Manager for Lenis smooth scroll and GSAP timeline scrubbing */}
        <ScrollManager />
        
      </main>
    </SimulationProvider>
  );
}
