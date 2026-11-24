import { useState, useCallback, useEffect, useRef } from 'react';

interface UseFullscreenOptions {
  onExitAttempt?: (exitCount: number) => void;
}

/**
 * The browser's keyboard lock (Chrome and Edge), available only in fullscreen. Locked, the system shortcuts that switch
 * away from the page (Alt+Tab, the Windows key) reach the page instead of the operating system, so the candidate
 * cannot flick to another application, such as an AI assistant, and back. Holding Escape still leaves fullscreen,
 * which is reported as an exit. Other browsers do not have it and are unaffected.
 */
type KeyboardLock = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };
const keyboardLock = (): KeyboardLock | undefined =>
  (navigator as unknown as { keyboard?: KeyboardLock }).keyboard;

export function useFullscreen(options?: UseFullscreenOptions) {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const intentionalExitRef = useRef(false);
  const onExitAttemptRef = useRef(options?.onExitAttempt);
  onExitAttemptRef.current = options?.onExitAttempt;

  useEffect(() => {
    const handler = () => {
      const nowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(nowFullscreen);
      // Locked on every way into fullscreen, not only through enterFullscreen: the interview also gets there through
      // the "return to full screen" button and after the screen-share picker, and a lock taken before fullscreen was
      // really on was refused without a word, leaving Alt+Tab working.
      if (nowFullscreen) {
        // Only Tab, which is what Alt+Tab needs. Locking every key also took the Windows key and Print Screen, so a
        // screenshot could not be taken, and held Escape. Those stay with the operating system.
        keyboardLock()?.lock?.(['Tab'])
          .catch((e: unknown) => console.warn('[fullscreen] Keyboard lock refused; Alt+Tab is not captured', e));
      } else {
        keyboardLock()?.unlock?.();
      }

      // If exited fullscreen and it was NOT intentional, count as a warning
      if (!nowFullscreen && !intentionalExitRef.current) {
        setFullscreenExitCount((prev) => {
          const next = prev + 1;
          onExitAttemptRef.current?.(next);
          return next;
        });
      }
      intentionalExitRef.current = false;
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      // The lock itself is taken by the fullscreenchange handler above, once fullscreen is really on.
    } catch {
      // Fullscreen not supported or denied
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        intentionalExitRef.current = true;
        keyboardLock()?.unlock?.();
        await document.exitFullscreen();
      }
    } catch {
      // Already exited
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return { isFullscreen, enterFullscreen, exitFullscreen, toggleFullscreen, fullscreenExitCount };
}
