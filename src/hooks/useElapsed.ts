import { useCallback, useEffect, useState } from 'react';

/**
 * Seconds since a moment: a clock that counts up and never ends anything.
 *
 * Anchored to a start instant rather than counting ticks, for the reasons the countdown timer is: a throttled
 * background tab or a closed laptop must not make it run slow, and a reload must pick up where it really was. The
 * start comes from the server, so reloading cannot reset it either.
 */
export function useElapsed() {
  const [startMs, setStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (startMs == null) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [startMs]);

  /** Begins counting from the given instant (epoch milliseconds), or from now. */
  const startAt = useCallback((ms?: number) => setStartMs(ms ?? Date.now()), []);

  const elapsedSeconds = startMs == null ? 0 : Math.max(0, Math.floor((nowMs - startMs) / 1000));
  return { elapsedSeconds, startAt };
}
