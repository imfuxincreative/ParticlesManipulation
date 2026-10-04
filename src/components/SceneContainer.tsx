"use client";

import React, { Suspense, useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ScrollControls, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { SceneModel } from "./SceneModel";
import { LenisScrollAdapter } from "./LenisScrollAdapter";
import { AtmosphereController } from "./atmosphere/AtmosphereController";
import { AtmosphereLighting } from "./atmosphere/AtmosphereLighting";
import { AtmospherePostFX } from "./atmosphere/AtmospherePostFX";
import { AtmosphereDebug } from "./atmosphere/AtmosphereDebug";

// --- Real-time R3F Asset Loading Tracker ---
const SceneProgressTracker: React.FC = () => {
  const { active, progress, loaded, total } = useProgress();
  const { updateSetting } = useSimulation();

  useEffect(() => {
    updateSetting("sceneLoadProgress", progress);
    if ((!active && progress >= 100) || (total > 0 && loaded >= total)) {
      updateSetting("isSceneLoaded", true);
    }
  }, [active, progress, loaded, total, updateSetting]);

  return null;
};

// --- WebGL Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WebGL/R3F Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// --- WebGL Availability Check ---
function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext;
  } catch {
    return false;
  }
}

// --- WebGL Unavailable Fallback UI ---
const WebGLFallback: React.FC = () => (
  <div className="w-full h-full absolute inset-0 z-0 flex items-center justify-center bg-slate-950">
    <div className="max-w-md text-center px-8 py-10 bg-slate-900/80 backdrop-blur-lg border border-white/10 rounded-2xl">
      <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-slate-100 mb-3">WebGL Context Unavailable</h2>
      <p className="text-sm text-slate-400 leading-relaxed mb-6">
        Your browser&apos;s WebGL context has been lost or hardware acceleration is disabled.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-5 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        Retry
      </button>
    </div>
  </div>
);

// --- Main Scene Container ---
export const SceneContainer: React.FC = () => {
  const { settings } = useSimulation();
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [shouldRenderCanvas, setShouldRenderCanvas] = useState(false);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    setIsMobile(isMobileUA || isSmallScreen);

    const timer = setTimeout(() => {
      setShouldRenderCanvas(true);
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  if (!webglAvailable) {
    return <WebGLFallback />;
  }

  if (!shouldRenderCanvas) {
    return <div className="w-full h-full absolute inset-0 z-0 bg-slate-950" />;
  }

  return (
    <WebGLErrorBoundary fallback={<WebGLFallback />}>
      <div className="w-full h-full absolute inset-0 z-0 canvas-container">
        <Canvas
          shadows="soft"
          camera={{
            position: [0, 0, 10],
            fov: 60,
            near: 0.1,
            far: 1000,
          }}
          dpr={isMobile ? 1.2 : [1, 1.5]}
          gl={{
            antialias: !isMobile,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <SceneProgressTracker />

          {/* Unified Atmosphere Controller & Single-source Lights */}
          <AtmosphereController />
          <AtmosphereLighting />

          <Suspense fallback={null}>
            <ScrollControls pages={Math.max(1, Math.round(5 / settings.scrollSpeed))} damping={settings.scrollDamping}>
              <LenisScrollAdapter />
              <SceneModel />
            </ScrollControls>
          </Suspense>

          {/* Atmosphere Post Processing Pipeline */}
          <AtmospherePostFX />
        </Canvas>

        {/* Developer Seam & Fog Overlay */}
        <AtmosphereDebug />

        {/* Floating Frame Overlay HUD */}
        <div className="flex fixed top-0 items-center justify-between gap-4">
          <span id="overlay-frame-val" className="text-[13px]">0</span>
        </div>
      </div>
    </WebGLErrorBoundary>
  );
};
