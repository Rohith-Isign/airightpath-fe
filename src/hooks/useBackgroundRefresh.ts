import { useEffect, useRef } from 'react';

/**
 * Runs `refresh` every `intervalMs` while the tab is visible, and straight away when the tab becomes visible or
 * focused again.
 *
 * For lists and counts that something else changes — an admin sending an exam or booking an interview — so a
 * candidate who is already looking at the screen sees it without reloading. A hidden tab does not poll.
 */
export function useBackgroundRefresh(refresh: () => void, intervalMs: number, enabled = true): void {
  // Always the latest closure, without restarting the timer whenever the caller re-renders.
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = window.setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
    };
  }, [intervalMs, enabled]);
}
