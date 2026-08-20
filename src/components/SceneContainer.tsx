"use client";

import React, { Suspense, useRef, useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ScrollControls, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { SceneModel } from "./SceneModel";
import { LenisScrollAdapter } from "./LenisScrollAdapter";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Image from "next/image";

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
        This is usually caused by a GPU driver crash or browser settings.
      </p>
      <div className="text-left text-xs text-slate-500 space-y-2 bg-slate-950/60 rounded-lg p-4 border border-white/5">
        <p className="font-semibold text-slate-300 mb-2">Try these steps:</p>
        <p>1. <strong className="text-slate-300">Close all Chrome tabs</strong> and reopen this page</p>
        <p>2. Go to <code className="text-purple-400 bg-slate-800 px-1.5 py-0.5 rounded">chrome://settings/system</code></p>
        <p>3. Enable <strong className="text-slate-300">&quot;Use hardware acceleration when available&quot;</strong></p>
        <p>4. Restart Chrome completely</p>
        <p>5. Or try <code className="text-purple-400 bg-slate-800 px-1.5 py-0.5 rounded">chrome://gpu</code> to check WebGL status</p>
      </div>
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

    // Defer heavy main 3D scene canvas startup by 250ms
    // so ParticleLoadingScreen initializes at 60 FPS first without thread lockups
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
  console.log('m')

  return (
    <WebGLErrorBoundary fallback={<WebGLFallback />}>
      <div className="w-full h-full absolute inset-0 z-0 canvas-container">
        <Canvas
          camera={{
            position: [0, 0, 10],
            fov: 60,
            near: 0.1,
            far: 100,
          }}
          dpr={isMobile ? 1.2 : [1, 1.5]}
          gl={{
            antialias: !isMobile,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl }) => {
            // Match Blender's viewport: disable tone mapping that darkens PBR materials
            gl.toneMapping = THREE.NoToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            // Handle context loss gracefully
            const canvas = gl.domElement;
            canvas.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              console.warn("WebGL context lost. Please refresh.");
            });
          }}
        >
          <SceneProgressTracker />
          <color attach="background" args={[settings.hazeColor]} />

          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 10, 7]} intensity={2.5} />
          <directionalLight position={[-5, 5, -5]} intensity={1.2} />
          <directionalLight position={[0, -5, 5]} intensity={0.8} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          {/* Hemisphere light for natural Blender-like ambient fill */}
          <hemisphereLight args={['#ffffff', '#444444', 1.5]} />

          <Suspense fallback={null}>
            <ScrollControls pages={Math.max(1, Math.round(5 / settings.scrollSpeed))} damping={settings.scrollDamping}>
              <LenisScrollAdapter />
              <SceneModel />
            </ScrollControls>
          </Suspense>

          {/* Restore vibrant glow and bright colors via Postprocessing Bloom */}
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <Bloom mipmapBlur intensity={settings.simonBloomIntensity} luminanceThreshold={1.1} luminanceSmoothing={0.1} />
          </EffectComposer>
        </Canvas>

        {/* <nav className="fixed top-0 lg:p-4 p-2 pt-3 left-0 z-[999]">
          <div className="">
            <h4>imfuCxinCreative</h4>


          </div>
        </nav> */}
        {/* <div className="Live cam fixed flex items-center gap-2 flex-col z-[99999] bottom-6 left-10 ">
          <Image src="/livecam.png" className="h-20 w-20 rounded-full" alt="Live Cam" width={100} height={100} />
          <p>Live cam</p>
        </div> */}

        {/* Floating Frame Overlay HUD */} <div className="flex fixed top-0 items-center justify-between gap-4">

          <span id="overlay-frame-val" className="text-[13px]">0</span>
        </div>

      </div>
    </WebGLErrorBoundary>
  );
};
