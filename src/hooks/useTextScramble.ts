"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function getRandomChar(matchChar?: string): string {
  if (matchChar === " ") return " ";
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

export interface UseTextScrambleOptions {
  speed?: number; // ms per tick (default: 26)
  visible?: boolean; // controls appear / disappear
  triggerKey?: any; // trigger shuffle/type transition on change
  progress?: number; // scroll-driven progress (0 to 1)
}

export function useTextScramble(
  text: string,
  options: UseTextScrambleOptions = {}
) {
  const { speed = 26, visible = true, triggerKey, progress } = options;

  const [displayText, setDisplayText] = useState<string>("");
  const [isScrambling, setIsScrambling] = useState<boolean>(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTextRef = useRef<string>("");

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Appear: Type in forward with text shuffle ──
  const appear = useCallback(
    (target: string, onComplete?: () => void) => {
      clearTimer();
      if (!target) {
        setDisplayText("");
        currentTextRef.current = "";
        setIsScrambling(false);
        onComplete?.();
        return;
      }

      setIsScrambling(true);
      let frame = 0;
      const maxFrames = Math.max(8, Math.floor(target.length * 2));

      intervalRef.current = setInterval(() => {
        frame += 1;
        const progress = frame / maxFrames;

        const currentLen = Math.min(target.length, Math.ceil(progress * (target.length + 1)));
        const settledLen = Math.max(0, Math.floor(progress * target.length));

        let output = "";
        for (let i = 0; i < currentLen; i++) {
          if (i < settledLen) {
            output += target[i];
          } else {
            output += getRandomChar(target[i]);
          }
        }

        setDisplayText(output);
        currentTextRef.current = output;

        if (frame >= maxFrames) {
          clearTimer();
          setDisplayText(target);
          currentTextRef.current = target;
          setIsScrambling(false);
          onComplete?.();
        }
      }, speed);
    },
    [speed, clearTimer]
  );

  // ── Disappear: Type out backward with text shuffle ──
  const disappear = useCallback(
    (onComplete?: () => void) => {
      clearTimer();
      const current = currentTextRef.current || text;
      if (!current || current.length === 0) {
        setDisplayText("");
        currentTextRef.current = "";
        setIsScrambling(false);
        onComplete?.();
        return;
      }

      setIsScrambling(true);
      let frame = 0;
      const initialLen = current.length;
      const maxFrames = Math.max(8, Math.floor(initialLen * 1.8));

      intervalRef.current = setInterval(() => {
        frame += 1;
        const progress = frame / maxFrames;

        const currentLen = Math.max(0, Math.floor((1 - progress) * initialLen));
        const settledLen = Math.max(0, Math.floor((1 - progress * 1.5) * initialLen));

        let output = "";
        for (let i = 0; i < currentLen; i++) {
          if (i < settledLen) {
            output += current[i] ?? getRandomChar();
          } else {
            output += getRandomChar(current[i]);
          }
        }

        setDisplayText(output);
        currentTextRef.current = output;

        if (frame >= maxFrames || currentLen === 0) {
          clearTimer();
          setDisplayText("");
          currentTextRef.current = "";
          setIsScrambling(false);
          onComplete?.();
        }
      }, speed);
    },
    [text, speed, clearTimer]
  );

  // ── In-place scramble for hover ──
  const triggerInPlaceScramble = useCallback(() => {
    if (!visible || !text) return;
    clearTimer();
    setIsScrambling(true);

    let frame = 0;
    const maxFrames = Math.max(8, Math.floor(text.length * 1.8));

    intervalRef.current = setInterval(() => {
      frame += 1;
      const progress = frame / maxFrames;
      const settledCount = Math.floor(progress * text.length);

      let output = "";
      for (let i = 0; i < text.length; i++) {
        if (i < settledCount) {
          output += text[i];
        } else {
          output += getRandomChar(text[i]);
        }
      }

      setDisplayText(output);
      currentTextRef.current = output;

      if (frame >= maxFrames) {
        clearTimer();
        setDisplayText(text);
        currentTextRef.current = text;
        setIsScrambling(false);
      }
    }, speed);
  }, [visible, text, speed, clearTimer]);

  // Scroll-driven progress scrub effect (when progress is provided)
  useEffect(() => {
    if (progress === undefined) return;
    clearTimer();

    if (progress <= 0) {
      setDisplayText("");
      currentTextRef.current = "";
      setIsScrambling(false);
      return;
    }

    if (progress >= 1) {
      setDisplayText(text);
      currentTextRef.current = text;
      setIsScrambling(false);
      return;
    }

    const target = text || "";
    const totalChars = target.length;
    if (totalChars === 0) {
      setDisplayText("");
      return;
    }

    setIsScrambling(true);
    const revealedCount = Math.floor(progress * totalChars);
    let output = "";
    for (let i = 0; i < totalChars; i++) {
      if (i < revealedCount) {
        output += target[i];
      } else if (i === revealedCount) {
        output += getRandomChar(target[i]);
      } else {
        break;
      }
    }
    setDisplayText(output);
    currentTextRef.current = output;
  }, [progress, text, clearTimer]);

  // Main lifecycle effect (timer-based): runs when progress is NOT provided
  useEffect(() => {
    if (progress !== undefined) return;
    if (visible) {
      appear(text);
    } else {
      disappear();
    }

    return () => {
      clearTimer();
    };
  }, [progress, visible, text, triggerKey, speed, appear, disappear, clearTimer]);

  return {
    displayText,
    isScrambling,
    triggerScramble: triggerInPlaceScramble,
  };
}
