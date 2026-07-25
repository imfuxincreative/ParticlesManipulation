"use client";

import React, { useEffect, useRef, useMemo } from "react";
import { useScroll, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import Lenis from "lenis";
import { useSimulation } from "@/context/SimulationContext";

interface SnapRange {
  start: number;
  end: number;
}

// Blender frame offset: GLTF scroll offset 0.0 maps to Blender frame -493
const BLENDER_FRAME_OFFSET = -493;

// Configurable checkpoints for magnetic snapping (in Blender frame numbers)
const SNAP_RANGES: SnapRange[] = [
  { start: -493, end: 0 },
  { start: 720, end: 1212 },
  { start: 1857, end: 2493 },
  { start: 3116, end: 3613 },
  { start: 4057, end: 4561 },

];

export const LenisScrollAdapter: React.FC = () => {
  const scroll = useScroll();
  const lenisRef = useRef<Lenis | null>(null);
  const { settings } = useSimulation();

  // Keep a mutable ref of settings to avoid destroying/recreating Lenis on every slider tick
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load the main scene GLTF to obtain total duration for frame calculations
  const sceneGltf = useGLTF("/SCENE.glb");

  // Compute max animation duration for the scene (based on SCENE.glb camera action)
  const sceneMaxDuration = useMemo(() => {
    const fallbackDuration = 168.43333333333334; // exact duration of camera track in SCENE.glb
    if (!sceneGltf) return fallbackDuration;
    let max = 0;
    const activeMixamoActionName = "mixamo.com.003";
    sceneGltf.animations.forEach((clip) => {
      const name = clip.name;
      if (name.toLowerCase().includes("mixamo") && name !== activeMixamoActionName) return;
      max = Math.max(max, clip.duration);
    });
    return max || fallbackDuration;
  }, [sceneGltf]);

  // Tracking user scroll inputs and active snapping
  const isInteractingRef = useRef(false);
  const lastInputTimeRef = useRef(0);
  const isSnappingRef = useRef(false);
  const lastDirectionRef = useRef(1); // 1 = forward/down, -1 = backward/up

  // Log on mount to confirm the adapter is active and loaded
  useEffect(() => {
    console.log(`[LenisScrollAdapter] Mounted. Max duration calculated: ${sceneMaxDuration.toFixed(3)}s (Total frames: ${(sceneMaxDuration * 30).toFixed(1)})`);
  }, [sceneMaxDuration]);

  useEffect(() => {
    if (!scroll || !scroll.el || !scroll.fill) return;

    const wrapper = scroll.el;
    const content = scroll.fill;

    // Configure Lenis to smooth out both mouse wheel and mobile touch gestures
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

    // Set initial scroll position to frame 0 on first time load
    let initialized = false;
    const initScrollToFrameZero = () => {
      if (initialized) return;
      if (lenis.limit > 0) {
        const targetOffset = (0 - BLENDER_FRAME_OFFSET) / (sceneMaxDuration * 30);
        const targetScroll = targetOffset * lenis.limit;
        lenis.scrollTo(targetScroll, { immediate: true });
        initialized = true;
        console.log(`[LenisScrollAdapter] Initialized scroll to frame 0 (Offset: ${targetOffset.toFixed(4)}, Scroll: ${targetScroll.toFixed(1)})`);
      } else {
        requestAnimationFrame(initScrollToFrameZero);
      }
    };
    requestAnimationFrame(initScrollToFrameZero);

    // Expose window functions for manual developer console diagnosis
    (window as any).snapToFrame = (frame: number) => {
      if (!lenisRef.current) {
        console.warn("[LenisScrollAdapter] Lenis is not ready yet.");
        return;
      }
      const targetOffset = (frame - BLENDER_FRAME_OFFSET) / (sceneMaxDuration * 30);
      const targetScroll = targetOffset * lenisRef.current.limit;
      console.log(`[LenisScrollAdapter] Manually snapping to frame ${frame} (Offset: ${targetOffset.toFixed(4)}, Pixels: ${targetScroll.toFixed(1)})`);
      isSnappingRef.current = true;
      lenisRef.current.scrollTo(targetScroll, {
        duration: settingsRef.current.scrollSnapDuration ?? 2.2,
        easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
        onComplete: () => {
          isSnappingRef.current = false;
        }
      });
    };

    (window as any).getScrollInfo = () => {
      if (!lenisRef.current) return { ready: false };
      const currentOffset = scroll.offset;
      const currentFrame = currentOffset * sceneMaxDuration * 30 + BLENDER_FRAME_OFFSET;
      const targetOffset = lenisRef.current.limit > 0 ? lenisRef.current.targetScroll / lenisRef.current.limit : 0;
      const targetFrame = targetOffset * sceneMaxDuration * 30 + BLENDER_FRAME_OFFSET;
      return {
        ready: true,
        scroll: lenisRef.current.scroll,
        targetScroll: lenisRef.current.targetScroll,
        limit: lenisRef.current.limit,
        offset: currentOffset,
        currentFrame: currentFrame.toFixed(1),
        targetFrame: targetFrame.toFixed(1),
        isInteracting: isInteractingRef.current,
        isSnapping: isSnappingRef.current,
        velocity: lenisRef.current.velocity,
        timeSinceLastInput: Date.now() - lastInputTimeRef.current
      };
    };

    // Track scroll events to detect manual user interaction and reset snap state
    const handleScroll = (e: any) => {
      if (e.event) {
        lastInputTimeRef.current = Date.now();
        isSnappingRef.current = false;
      }
    };
    lenis.on("scroll", handleScroll);

    // Track pointer and touch interactions to prevent snapping while holding/dragging
    const handlePointerDown = () => {
      isInteractingRef.current = true;
      isSnappingRef.current = false;
      lastInputTimeRef.current = Date.now();
    };

    const handlePointerUp = () => {
      isInteractingRef.current = false;
      lastInputTimeRef.current = Date.now();
    };

    const handlePointerMove = () => {
      if (isInteractingRef.current) {
        lastInputTimeRef.current = Date.now();
      }
    };

    const handleWheelInput = () => {
      isSnappingRef.current = false;
      lastInputTimeRef.current = Date.now();
    };

    wrapper.addEventListener("wheel", handleWheelInput, { passive: true });
    wrapper.addEventListener("touchstart", handlePointerDown, { passive: true });
    wrapper.addEventListener("touchmove", handlePointerMove, { passive: true });
    wrapper.addEventListener("touchend", handlePointerUp, { passive: true });
    wrapper.addEventListener("touchcancel", handlePointerUp, { passive: true });
    wrapper.addEventListener("pointerdown", handlePointerDown, { passive: true });
    wrapper.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, { passive: true });

    // Dynamically adjust Lenis size when page layout or number of pages changes
    const resizeObserver = new ResizeObserver(() => {
      lenis.resize();
    });

    resizeObserver.observe(wrapper);
    if (content) {
      resizeObserver.observe(content);
    }

    return () => {
      delete (window as any).snapToFrame;
      delete (window as any).getScrollInfo;
      resizeObserver.disconnect();
      lenis.off("scroll", handleScroll);
      wrapper.removeEventListener("wheel", handleWheelInput);
      wrapper.removeEventListener("touchstart", handlePointerDown);
      wrapper.removeEventListener("touchmove", handlePointerMove);
      wrapper.removeEventListener("touchend", handlePointerUp);
      wrapper.removeEventListener("touchcancel", handlePointerUp);
      wrapper.removeEventListener("pointerdown", handlePointerDown);
      wrapper.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [scroll, scroll.el, scroll.fill, sceneMaxDuration]);

  // Tick Lenis physics in R3F frame loop so that it updates smoothly before R3F renders
  useFrame((state) => {
    // Calculate and update the DOM overlay values smoothly from the raw scroll state immediately.
    // This runs independent of Lenis, ensuring the overlay frame count is always active as you scroll.
    const rawOffset = scroll ? scroll.offset : 0;
    const rawFrame = rawOffset * sceneMaxDuration * 30 + BLENDER_FRAME_OFFSET;

    const frameValEl = document.getElementById("overlay-frame-val");
    const offsetValEl = document.getElementById("overlay-offset-val");
    if (frameValEl) frameValEl.innerText = rawFrame.toFixed(0);
    if (offsetValEl) offsetValEl.innerText = rawOffset.toFixed(4);

    // Dispatch custom event for frame changes so overlays can update efficiently
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("scroll-frame-change", {
          detail: { frame: rawFrame, offset: rawOffset },
        })
      );
    }

    if (lenisRef.current) {
      const lenis = lenisRef.current;

      // Prevent scroll target from running too far ahead of the current position (only during user manual scroll, NOT during snapping).
      if (!isSnappingRef.current) {
        const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
        const capMultiplier = isMobile ? 0.45 : 0.8;
        const maxDistance = typeof window !== "undefined" ? window.innerHeight * capMultiplier : 600;

        const diff = lenis.targetScroll - lenis.scroll;
        if (Math.abs(diff) > maxDistance) {
          lenis.targetScroll = lenis.scroll + Math.sign(diff) * maxDistance;
        }
      }

      // Lenis raf requires elapsed time in milliseconds
      lenis.raf(state.clock.getElapsedTime() * 1000);

      // Track last scroll direction (1 = forward/down, -1 = backward/up)
      if (Math.abs(lenis.velocity) > 0.05) {
        lastDirectionRef.current = Math.sign(lenis.velocity);
      }

      // --- Checkpoint Snapping Logic ---
      const timeSinceLastInput = Date.now() - lastInputTimeRef.current;
      const isUserNotInteracting = !isInteractingRef.current || timeSinceLastInput > 800;

      const targetOffset = lenis.limit > 0 ? lenis.targetScroll / lenis.limit : 0;
      const targetFrame = targetOffset * sceneMaxDuration * 30 + BLENDER_FRAME_OFFSET;

      const currentOffset = lenis.limit > 0 ? lenis.scroll / lenis.limit : 0;
      const currentFrame = currentOffset * sceneMaxDuration * 30 + BLENDER_FRAME_OFFSET;

      // Snapping is triggered only when the scroll velocity is low (almost stopped)
      const isLowVelocity = Math.abs(lenis.velocity) < 2.5;

      // Log when near/inside the range to help debug trigger state
      if (currentFrame >= 3000 && currentFrame <= 3700) {
        console.log(
          `[LenisScrollAdapter debug] CurrentFrame: ${currentFrame.toFixed(1)}, TargetFrame: ${targetFrame.toFixed(1)}, Offset: ${scroll.offset.toFixed(4)}, Velocity: ${lenis.velocity.toFixed(3)}, LowVel: ${isLowVelocity}, Interacting: ${isInteractingRef.current}, Time since input: ${timeSinceLastInput}ms, NotInteracting: ${isUserNotInteracting}`
        );
      }

      if (
        settings.enableScrollSnap &&
        isUserNotInteracting &&
        timeSinceLastInput > 150 &&
        isLowVelocity &&
        !isSnappingRef.current &&
        lenis.limit > 0
      ) {
        for (const range of SNAP_RANGES) {
          // Check if the current physical position is inside the snap range
          if (currentFrame >= range.start && currentFrame <= range.end) {
            const totalDist = range.end - range.start;
            const progress = totalDist > 0 ? (currentFrame - range.start) / totalDist : 0;

            const threshold = settings.scrollSnapThreshold ?? 0.20;
            let snapTargetFrame: number;

            if (lastDirectionRef.current >= 0) {
              // Scrolling forward: if past threshold (e.g. 20%), snap to end. Otherwise snap back to start.
              snapTargetFrame = progress > threshold ? range.end : range.start;
            } else {
              // Scrolling backward: if scrolled more than threshold away from end (progress < 1 - threshold, e.g. 80%), snap to start. Otherwise snap back to end.
              snapTargetFrame = progress < (1.0 - threshold) ? range.start : range.end;
            }

            // Tolerance check (0.2 frame)
            if (Math.abs(currentFrame - snapTargetFrame) > 0.2) {
              const snapTargetOffset = (snapTargetFrame - BLENDER_FRAME_OFFSET) / (sceneMaxDuration * 30);
              const targetScrollPixels = snapTargetOffset * lenis.limit;

              isSnappingRef.current = true;
              console.log(
                `[LenisScrollAdapter] Snapping from current frame ${currentFrame.toFixed(1)} to checkpoint frame ${snapTargetFrame} (progress: ${(progress * 100).toFixed(1)}%, direction: ${lastDirectionRef.current >= 0 ? "forward" : "backward"}, threshold: ${(threshold * 100).toFixed(0)}%)`
              );

              lenis.scrollTo(targetScrollPixels, {
                duration: settings.scrollSnapDuration ?? 2.2,
                easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic (softer & looser!)
                onComplete: () => {
                  isSnappingRef.current = false;
                },
              });
            }
            break; // only snap one range
          }
        }
      }
    }
  });

  return null;
};

