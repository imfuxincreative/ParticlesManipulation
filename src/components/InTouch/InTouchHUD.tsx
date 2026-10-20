"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLoopTransition } from "@/components/transitions/transitionConfig";
import {
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  Mail,
  Copy,
  Check,
  X,
  MessageSquare,
} from "lucide-react";

export const InTouchHUD: React.FC = () => {
  const activeScene = useLoopTransition((s) => s.activeScene);
  const inTouchState = useLoopTransition((s) => s.inTouchState);
  const isTransitioning = useLoopTransition((s) => s.isTransitioning);
  const returnToMainScene = useLoopTransition((s) => s.returnToMainScene);
  const setInTouchHoverProximity = useLoopTransition(
    (s) => s.setInTouchHoverProximity
  );

  const [visible, setVisible] = useState(false);
  const [proximity, setProximity] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const rafId = useRef<number | null>(null);

  // Manage visibility synchronized with active scene lifecycle
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeScene === "inTouch" && inTouchState === "active" && !isTransitioning) {
      timer = setTimeout(() => {
        setVisible(true);
      }, 700);
    } else {
      setVisible(false);
      setShowContactModal(false);
      setProximity(0);
      setInTouchHoverProximity(0);
      if (typeof window !== "undefined") {
        (window as any).__IN_TOUCH_PROXIMITY__ = 0;
      }
    }
    return () => clearTimeout(timer);
  }, [activeScene, inTouchState, isTransitioning, setInTouchHoverProximity]);

  // Continuous distance tracking between cursor and "Get In Touch" button
  useEffect(() => {
    if (!visible || activeScene !== "inTouch") {
      setInTouchHoverProximity(0);
      setProximity(0);
      return;
    }

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      // Distance threshold: proximity starts at 380px away and peaks at button boundary
      const maxDistance = 380;
      const minDistance = Math.min(rect.width, rect.height) * 0.45;

      let p = 0;
      if (dist <= minDistance) {
        p = 1.0;
      } else if (dist < maxDistance) {
        const t = 1 - (dist - minDistance) / (maxDistance - minDistance);
        // Smoothstep interpolation for gradual, lifelike weight transition
        p = t * t * (3 - 2 * t);
      }

      // Sync with global store and Three.js animation engine
      setInTouchHoverProximity(p);
      if (typeof window !== "undefined") {
        (window as any).__IN_TOUCH_PROXIMITY__ = p;
      }

      // Throttle local state update via requestAnimationFrame for smooth 60fps UI feedback
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          setProximity(p);
          rafId.current = null;
        });
      }
    };

    const handlePointerLeave = () => {
      setProximity(0);
      setInTouchHoverProximity(0);
      if (typeof window !== "undefined") {
        (window as any).__IN_TOUCH_PROXIMITY__ = 0;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      setInTouchHoverProximity(0);
    };
  }, [visible, activeScene, setInTouchHoverProximity]);

  const handleCopyEmail = useCallback(() => {
    navigator.clipboard.writeText("meejanursk@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (activeScene !== "inTouch" && !visible) {
    return null;
  }

  return (
    <>
      <div
        className={`fixed inset-0 pointer-events-none z-30 flex flex-col justify-between items-center p-6 md:p-8 select-none transition-opacity duration-1000 ${
          visible && !isTransitioning ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top Atmosphere Subtitle & Interactive State Badge */}
        <div className="pt-2 flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/20 backdrop-blur-md">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                proximity > 0.05
                  ? "bg-red-400 shadow-[0_0_10px_#ff0033] animate-pulse"
                  : "bg-red-500/50"
              }`}
            />
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-red-200/80 font-mono">
              Interactive Scene // inTouch
            </p>
          </div>
        </div>

        {/* Center-Bottom Floating "Get in touch" Interactive Trigger */}
        <div className="my-auto pb-4 flex flex-col items-center gap-3 pointer-events-auto">
          <div className="relative group">
            {/* Ambient Dynamic Crimson Radial Aura (scales & glows with proximity) */}
            <div
              className="absolute -inset-3 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600 transition-all duration-150 pointer-events-none"
              style={{
                opacity: Math.max(0.12, proximity * 0.85),
                transform: `scale(${1.0 + proximity * 0.22})`,
                filter: `blur(${16 + proximity * 18}px)`,
              }}
            />

            {/* Main "Get in touch" Button */}
            <button
              ref={buttonRef}
              onClick={() => setShowContactModal(true)}
              className="relative flex items-center gap-3 px-7 py-3 sm:px-9 sm:py-3.5 rounded-full bg-gradient-to-r from-black/85 via-red-950/70 to-black/85 border border-red-500/30 hover:border-red-400 backdrop-blur-2xl text-red-100 tracking-wider transition-all duration-300 shadow-[0_8px_32px_rgba(255,0,30,0.2)] hover:shadow-[0_8px_45px_rgba(255,0,30,0.55)] cursor-pointer"
              style={{
                borderColor: `rgba(255, ${60 + proximity * 140}, ${70 + proximity * 120}, ${
                  0.3 + proximity * 0.65
                })`,
                boxShadow: `0 8px 32px rgba(255, 0, 30, ${0.15 + proximity * 0.45})`,
                transform: `scale(${1.0 + proximity * 0.04})`,
              }}
            >
              {/* Dynamic Sparkle / Contact Icon */}
              <div
                className="relative flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20 text-red-300 transition-transform duration-300"
                style={{
                  transform: `rotate(${proximity * 45}deg) scale(${1.0 + proximity * 0.15})`,
                  backgroundColor: `rgba(255, 0, 30, ${0.15 + proximity * 0.35})`,
                }}
              >
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
              </div>

              {/* Button Text */}
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-red-50">
                  Get in touch
                </span>
                <span className="text-[9px] sm:text-[10px] tracking-widest text-red-300/60 font-mono">
                  {proximity > 0.08
                    ? `Reaching out • ${(proximity * 100).toFixed(0)}%`
                    : "Reach across the glass"}
                </span>
              </div>

              {/* Arrow Indicator */}
              <ArrowUpRight
                className="w-4 h-4 text-red-400/80 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                style={{
                  opacity: 0.6 + proximity * 0.4,
                  transform: `translate(${proximity * 2}px, ${-proximity * 2}px)`,
                }}
              />
            </button>
          </div>

          {/* Micro guidance notice */}
          <p
            className="text-[10px] sm:text-xs text-red-300/40 tracking-widest font-mono text-center transition-opacity duration-300"
            style={{ opacity: Math.max(0.35, 1 - proximity * 0.6) }}
          >
            Move cursor closer to initiate hand gesture
          </p>
        </div>

        {/* Bottom Controls / Journey Loop */}
        <div className="pb-2 flex flex-col items-center gap-2.5 pointer-events-auto">
          <button
            onClick={() => returnToMainScene("first")}
            className="group flex items-center gap-2 px-4 py-2 rounded-full bg-red-950/30 hover:bg-red-900/50 border border-red-500/20 hover:border-red-400/40 backdrop-blur-md text-red-200/90 text-xs tracking-wider transition-all duration-300 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
          >
            <RotateCcw className="w-3 h-3 text-red-400 group-hover:-rotate-90 transition-transform duration-300" />
            <span>Return to Journey</span>
          </button>

          <p className="text-[9px] sm:text-[11px] text-red-300/35 tracking-widest font-mono">
            Scroll down or click to loop &bull; Scroll up to return
          </p>
        </div>
      </div>

      {/* Floating Glassmorphic Contact Dialog */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-stone-950/95 via-red-950/40 to-stone-950/95 border border-red-500/30 p-6 sm:p-7 shadow-[0_16px_60px_rgba(255,0,30,0.3)] backdrop-blur-2xl">
            {/* Close Button */}
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-red-300/60 hover:text-red-100 hover:bg-red-900/30 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(255,0,30,0.3)]">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-wider text-red-100 uppercase">
                  Let's Connect
                </h3>
                <p className="text-[11px] text-red-300/60 font-mono tracking-wider">
                  Direct Line // inTouch
                </p>
              </div>
            </div>

            <p className="text-xs text-red-200/80 leading-relaxed mb-6">
              Have an idea, project, or collaboration in mind? Reach across the glass and say hello.
            </p>

            {/* Email Contact Box */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-red-950/30 border border-red-500/20 mb-4">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Mail className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs text-red-100 font-mono truncate select-all">
                  meejanursk@gmail.com
                </span>
              </div>
              <button
                onClick={handleCopyEmail}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <a
                href="mailto:meejanursk@gmail.com?subject=Let's%20Get%20In%20Touch"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold tracking-wider uppercase transition-all shadow-[0_4px_20px_rgba(255,0,30,0.4)] cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open Mail Client</span>
              </a>

              <a
                href="https://github.com/imfuxincreative"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-red-200 text-xs font-medium tracking-wider transition-all cursor-pointer"
              >
                <span>View Github Portfolio</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
