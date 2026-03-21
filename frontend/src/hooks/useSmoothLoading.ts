'use client';

import { useEffect, useRef, useState } from 'react';

interface SmoothLoadingOptions {
  delayMs?: number;
  minVisibleMs?: number;
}

export function useSmoothLoading(loading: boolean, options?: SmoothLoadingOptions) {
  const delayMs = options?.delayMs ?? 150;
  const minVisibleMs = options?.minVisibleMs ?? 250;

  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current != null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    clearTimers();

    if (loading) {
      if (visible) {
        return clearTimers;
      }
      showTimerRef.current = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, delayMs);
      return clearTimers;
    }

    if (!visible) {
      return clearTimers;
    }

    const shownAt = shownAtRef.current ?? Date.now();
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    hideTimerRef.current = window.setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);

    return clearTimers;
  }, [loading, visible, delayMs, minVisibleMs]);

  return visible;
}
