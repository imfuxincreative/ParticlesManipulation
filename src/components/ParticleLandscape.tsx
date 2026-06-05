"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSimulation } from "@/context/SimulationContext";
import { DepthParticleShader } from "@/shaders/depthShader";

export const ParticleLandscape: React.FC = () => {
  const { settings, setVideoElement, scrollPercent } = useSimulation();
  const { viewport } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const lastSeekTimeRef = useRef(-1);
  
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [videoError, setVideoError] = useState(false);

  const { scaleX, scaleY } = useMemo(() => {
    const videoAspect = 16 / 9; // standard 16:9 aspect ratio
    const viewportAspect = viewport.width / viewport.height;
    
    let planeWidth = viewport.width;
    let planeHeight = viewport.height;
    
    // Cover the viewport
    if (viewportAspect > videoAspect) {
      planeHeight = viewport.width / videoAspect;
    } else {
      planeWidth = viewport.height * videoAspect;
    }

    // Add a scaling factor so when the particles are pushed away (z < 0) they still cover the screen
    // Since camera is at z=10, and depth can push them back by ~8 units, distance is 18 vs 10.
    // 18/10 = 1.8. So a scale factor of 1.8 ensures no edges are visible when pushed back.
    const coverageScale = 1.8; 
    planeWidth *= coverageScale;
    planeHeight *= coverageScale;

    // The physicalSize of the geometry is 16
    return {
      scaleX: planeWidth / 16,
      scaleY: planeHeight / 16,
    };
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    const vid = document.createElement("video");
    vid.src = settings.videoUrl;
    vid.crossOrigin = "anonymous";
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = "auto";
    
    const handleError = () => {
      console.warn(`Video failed to load: ${settings.videoUrl}. Falling back to real-time GPU procedural generation.`);
      setVideoError(true);
    };

    const handleCanPlay = () => {
      setVideoError(false);
    };

    const handleLoadedMetadata = () => {
      if (vid.duration === Infinity) {
        // Workaround for Chrome bug with some MP4/WebM videos
        vid.currentTime = 1e101;
        const getDuration = () => {
          vid.currentTime = 0;
          vid.removeEventListener("timeupdate", getDuration);
        };
        vid.addEventListener("timeupdate", getDuration);
      }
    };

    vid.addEventListener("error", handleError);
    vid.addEventListener("abort", handleError);
    vid.addEventListener("canplay", handleCanPlay);
    vid.addEventListener("loadedmetadata", handleLoadedMetadata);

    vid.load();
    
    setVideo(vid);
    setVideoElement(vid);

    return () => {
      vid.removeEventListener("error", handleError);
      vid.removeEventListener("abort", handleError);
      vid.removeEventListener("canplay", handleCanPlay);
      vid.removeEventListener("loadedmetadata", handleLoadedMetadata);
      vid.pause();
      vid.src = "";
      vid.load();
      setVideoElement(null);
    };
  }, [settings.videoUrl, setVideoElement]);

  // Create VideoTexture
  const videoTexture = useMemo(() => {
    if (!video) return null;
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [video]);

  // Create static dummy texture to bind when video is not loaded (prevents WebGL warnings)
  const dummyTexture = useMemo(() => {
    if (typeof window === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);

  // Build grid of particles
  const { positions, uvs } = useMemo(() => {
    const size = settings.gridSize;
    const count = size * size;
    const posArray = new Float32Array(count * 3);
    const uvArray = new Float32Array(count * 2);
    
    const physicalSize = 16; // Width and height of the particle plane in 3D units

    for (let i = 0; i < count; i++) {
      const x = i % size;
      const y = Math.floor(i / size);

      // Map to center plane
      posArray[i * 3] = (x / (size - 1) - 0.5) * physicalSize;
      posArray[i * 3 + 1] = (y / (size - 1) - 0.5) * physicalSize;
      posArray[i * 3 + 2] = 0; // Z coordinate starts at 0, displaced in shader

      // UV coordinates (0.0 to 1.0)
      uvArray[i * 2] = x / (size - 1);
      uvArray[i * 2 + 1] = y / (size - 1);
    }

    return {
      positions: posArray,
      uvs: uvArray,
    };
  }, [settings.gridSize]);

  // Set up uniforms for the ShaderMaterial
  const uniforms = useMemo(() => {
    return {
      uVideoTexture: { value: null as THREE.Texture | null },
      uDepthScale: { value: settings.depthScale },
      uTime: { value: 0 },
      uNoiseStrength: { value: settings.noiseStrength },
      uNoiseSpeed: { value: settings.noiseSpeed },
      uPointSize: { value: settings.pointSize },
      uFocusDepth: { value: settings.focusDepth },
      uFocusRange: { value: settings.focusRange },
      uBokehScale: { value: settings.bokehScale },
      uHazeColor: { value: new THREE.Color(settings.hazeColor) },
      uHazeDensity: { value: settings.hazeDensity },
      uTint: { value: new THREE.Color(settings.tintColor) },
      uTintMix: { value: settings.tintMix },
      uOpacity: { value: settings.opacity },
      uDensityControl: { value: settings.densityControl },
      uUseFallback: { value: 0.0 },
      uIsDoubleWidth: { value: 0.0 },
      uScrollProgress: { value: 0.0 },
    };
  }, []);

  // Update uniforms when reactive settings change
  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uDepthScale.value = settings.depthScale;
    u.uNoiseStrength.value = settings.noiseStrength;
    u.uNoiseSpeed.value = settings.noiseSpeed;
    u.uPointSize.value = settings.pointSize;
    u.uFocusDepth.value = settings.focusDepth;
    u.uFocusRange.value = settings.focusRange;
    u.uBokehScale.value = settings.bokehScale;
    u.uHazeColor.value.set(settings.hazeColor);
    u.uHazeDensity.value = settings.hazeDensity;
    u.uTint.value.set(settings.tintColor);
    u.uTintMix.value = settings.tintMix;
    u.uOpacity.value = settings.opacity;
    u.uDensityControl.value = settings.densityControl;
    u.uUseFallback.value = videoError ? 1.0 : 0.0;
    u.uIsDoubleWidth.value = settings.videoMode === "rgbd" ? 1.0 : 0.0;
  }, [settings, videoError]);

  // Bind active texture (video or fallback) to uniforms
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uVideoTexture.value = (videoError || !videoTexture) ? dummyTexture : videoTexture;
  }, [videoError, videoTexture, dummyTexture]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (materialRef.current) {
      // Update dynamic uniforms
      materialRef.current.uniforms.uTime.value = time;
      materialRef.current.uniforms.uScrollProgress.value = scrollPercent;
    }

    // Handle scroll-synced video scrubbing (when not autoplaying).
    // Seeking is done here — inside the render loop — so the texture
    // upload (needsUpdate) is guaranteed to happen in the same frame.
    if (video && !settings.isPlaying) {
      const dur = video.duration;
      if (dur && Number.isFinite(dur) && dur > 0) {
        const targetTime = scrollPercent * dur;
        // Seek whenever the scroll has actually moved.
        // No video.seeking guard — the browser cancels stale seeks automatically
        // when a new currentTime is assigned, which keeps things responsive.
        if (Math.abs(targetTime - lastSeekTimeRef.current) > 0.001) {
          video.currentTime = targetTime;
          lastSeekTimeRef.current = targetTime;
        }
      }

      // Force the texture upload so the GPU gets the freshest decoded frame.
      if (videoTexture) {
        videoTexture.needsUpdate = true;
      }
    }
  });

  return (
    <points ref={pointsRef} scale={[scaleX, scaleY, 1]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-uv"
          args={[uvs, 2]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={DepthParticleShader.vertexShader}
        fragmentShader={DepthParticleShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
};
