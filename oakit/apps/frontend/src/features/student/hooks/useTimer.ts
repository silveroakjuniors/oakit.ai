/**
 * Student Module - Timer Hook
 * Manages countdown timer for quizzes and tests
 */

import { useEffect, useRef, useCallback } from 'react';

export interface UseTimerReturn {
  start: (initialSeconds: number, onTimeout: () => void) => void;
  stop: () => void;
  clear: () => void;
}

export function useTimer(time: number): UseTimerReturn {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(
    (initialSeconds: number, onTimeout: () => void) => {
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        // Note: This hook doesn't update state directly.
        // Parent component should call decrement callback on interval
        if (initialSeconds <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onTimeout();
        }
      }, 1000);
    },
    []
  );

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    stop();
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { start, stop, clear };
}
