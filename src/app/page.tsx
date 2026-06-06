"use client";

import React from "react";
import dynamic from "next/dynamic";
import { SimulationProvider } from "@/context/SimulationContext";
import { Dashboard } from "@/components/Dashboard";
import { ModelNavigation } from "@/components/ModelNavigation";

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
        
        {/* Model Switching Arrows */}
        <ModelNavigation />
        
      </main>
    </SimulationProvider>
  );
}
