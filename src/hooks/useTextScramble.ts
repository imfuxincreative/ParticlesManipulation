"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export interface UseTextScrambleOptions {
  speed?: number; // ms per tick (default: 30)
  characters?: string; // character pool to pick from
  scrambleOnMount?: boolean;
  animateOnChange?: boolean; // shuffle when text prop changes
  triggerKey?: any; // trigger a shuffle when this key/value changes (excluding initial mount)
}

export function useTextScramble(
  text: string,
  options: UseTextScrambleOptions = {}
) {
  const {
    speed = 30,
    characters = DEFAULT_CHARS,
    scrambleOnMount = false,
    animateOnChange = false,
    triggerKey,
  } = options;

  const [displayText, setDisplayText] = useState<string>(text);
  const [isScrambling, setIsScrambling] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameRef = useRef<number>(0);

  const stopScramble = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsScrambling(false);
  }, []);

  const triggerScramble = useCallback(
    (targetText: string = text) => {
      stopScramble();
      setIsScrambling(true);

      frameRef.current = 0;
      const target = targetText;
      const maxFrames = Math.max(10, Math.floor(target.length * 2.2));

      intervalRef.current = setInterval(() => {
        frameRef.current += 1;
        const progress = frameRef.current / maxFrames;

        let output = "";
        const settledCount = Math.floor(progress * target.length);

        for (let i = 0; i < target.length; i++) {
          const char = target[i];
          if (char === " ") {
            output += " ";
          } else if (i < settledCount) {
            output += char;
          } else {
            // Keep casing matched so text height and glyph baseline stay stable
            const isLower = char >= "a" && char <= "z";
            const pool = isLower
              ? "abcdefghijklmnopqrstuvwxyz"
              : "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            const randIdx = Math.floor(Math.random() * pool.length);
            output += pool[randIdx];
          }
        }

        setDisplayText(output);

        if (frameRef.current >= maxFrames) {
          stopScramble();
          setDisplayText(target);
        }
      }, speed);
    },
    [text, characters, speed, stopScramble]
  );

  // Auto-scramble whenever input text changes
  const prevTextRef = useRef<string>(text);
  useEffect(() => {
    if (prevTextRef.current !== text) {
      prevTextRef.current = text;
      if (animateOnChange) {
        triggerScramble(text);
      } else {
        stopScramble();
        setDisplayText(text);
      }
    }
  }, [text, triggerScramble, animateOnChange, stopScramble]);

  // Trigger scramble on external triggerKey changes (skips initial mount)
  const isFirstMount = useRef(true);
  const prevTriggerKey = useRef(triggerKey);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevTriggerKey.current = triggerKey;
      return;
    }
    if (triggerKey !== undefined && triggerKey !== prevTriggerKey.current) {
      prevTriggerKey.current = triggerKey;
      triggerScramble(text);
    }
  }, [triggerKey, text, triggerScramble]);

  // Optional trigger on initial mount
  useEffect(() => {
    if (scrambleOnMount) {
      triggerScramble(text);
    }
    return () => stopScramble();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    displayText,
    isScrambling,
    triggerScramble,
  };
}
