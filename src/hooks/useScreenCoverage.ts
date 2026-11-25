import { useEffect, useRef } from 'react';

/** How far the page may shrink below its fullscreen size before it counts: browser chrome flickers, panels do not. */
const SHRINK_RATIO = 0.92;

/**
 * Notices when the interview stops filling the screen while it is in fullscreen: a browser side panel (an AI
 * assistant built into the browser, for instance) or another window docked over part of it.
 *
 * <p>A web page cannot see or close other applications, but it can see its own size. In fullscreen it fills the
 * screen; a side panel opening takes width from it. The size is measured when fullscreen starts and compared after
 * that, ignoring browser zoom (which changes the size too, but also the pixel ratio). Reported once each time it
 * happens, and again only after the page has been restored to full size.</p>
 */
export function useScreenCoverage({
  active,
  onReduced,
}: Readonly<{ active: boolean; onReduced: (detail: string) => void }>) {
  const onReducedRef = useRef(onReduced);
  onReducedRef.current = onReduced;

  useEffect(() => {
    if (!active) return;
    let baseline: { w: number; h: number; dpr: number } | null = null;
    let reduced = false;

    const measure = () => {
      if (!document.fullscreenElement) {
        // Leaving fullscreen is reported on its own; start again when it comes back.
        baseline = null;
        reduced = false;
        return;
      }
      const now = { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio };
      if (!baseline || baseline.dpr !== now.dpr) {
        baseline = now; // first measurement in fullscreen, or the zoom changed
        reduced = false;
        return;
      }
      const shrunk = now.w < baseline.w * SHRINK_RATIO || now.h < baseline.h * SHRINK_RATIO;
      if (shrunk && !reduced) {
        reduced = true;
        onReducedRef.current(
          `The interview did not fill the screen (${now.w}x${now.h} of ${baseline.w}x${baseline.h}): a side panel ` +
            'or another window was open over it',
        );
      } else if (!shrunk) {
        reduced = false;
        baseline = { ...now, w: Math.max(baseline.w, now.w), h: Math.max(baseline.h, now.h) };
      }
    };

    measure();
    window.addEventListener('resize', measure);
    document.addEventListener('fullscreenchange', measure);
    const id = window.setInterval(measure, 2000);
    return () => {
      window.removeEventListener('resize', measure);
      document.removeEventListener('fullscreenchange', measure);
      window.clearInterval(id);
    };
  }, [active]);
}
