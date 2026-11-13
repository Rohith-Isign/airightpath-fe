import { useCallback, useRef, useState, useEffect } from 'react';
import { ChevronsUpDown, FileText, Maximize2, Minimize2 } from 'lucide-react';

interface CodingEditorProps {
  code: string;
  onCodeChange: (code: string) => void;
  disabled?: boolean;
}

const MIN_HEIGHT = 140;
const MAX_HEIGHT = 900;

/**
 * Preferred heights as a share of the viewport, not fixed pixels, so the same
 * proportions hold on a laptop and on a phone held in landscape, and a rotate
 * cannot leave a tall editor in a short window.
 */
const DEFAULT_RATIO = 0.3;
const TALL_RATIO = 0.55;
const CAP_RATIO = 0.6;

const measure = () => {
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const at = (ratio: number) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(vh * ratio)));
  return { base: at(DEFAULT_RATIO), tall: at(TALL_RATIO), max: at(CAP_RATIO) };
};

/**
 * A plain notepad for the L2 coding question: no compiler, no run, no language
 * picker, no syntax colouring. The candidate writes code in any language, or
 * pseudocode, or just the logic, and sends it; the interviewer reads it.
 * Monaco is deliberately not used: its language modes, autocomplete and
 * bracket-closing make it behave like an IDE, which this is not.
 */
export function CodingEditor({ code, onCodeChange, disabled }: CodingEditorProps) {
  const [limits, setLimits] = useState(measure);
  const [height, setHeight] = useState(() => measure().base);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const check = () => {
      const next = measure();
      setLimits(next);
      // Re-clamp rather than reset, so a size the candidate dragged to survives a rotate.
      setHeight((h) => Math.min(next.max, Math.max(MIN_HEIGHT, h)));
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  const clamp = useCallback(
    (value: number) => Math.min(limits.max, Math.max(MIN_HEIGHT, value)),
    [limits.max]
  );

  // Pointer events rather than mouse, so a drag works on a touchscreen too.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [height]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setHeight(clamp(drag.startHeight + (e.clientY - drag.startY)));
  }, [clamp]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const isTall = height >= limits.tall;

  // Tab inserts spaces instead of moving focus: a candidate indenting code
  // would otherwise tab out of the box and lose their place.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = code.slice(0, selectionStart) + '    ' + code.slice(selectionEnd);
    onCodeChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 4;
    });
  };

  return (
    <div className="w-full min-w-0 max-w-full border border-[var(--border)] rounded-xl overflow-hidden bg-[#1e1e1e] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-2 sm:px-3 bg-[#252526] border-b border-[#3c3c3c]">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText size={14} className="shrink-0 text-blue-400" />
          <span className="truncate text-xs font-medium text-gray-300">
            Notepad — write your code or logic in any language
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHeight(isTall ? limits.base : limits.tall)}
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-gray-400 hover:bg-[#3c3c3c] hover:text-gray-200 transition-colors sm:px-2"
          title={isTall ? 'Shrink notepad' : 'Expand notepad'}
          aria-label={isTall ? 'Shrink notepad' : 'Expand notepad'}
        >
          {isTall ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span className="hidden sm:inline">{isTall ? 'Shrink' : 'Expand'}</span>
        </button>
      </div>

      <textarea
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="Write your code, pseudocode or logic here, in any language. It is not compiled or run; the interviewer reads it."
        style={{ height }}
        // text-base, not text-sm: iOS Safari zooms the whole page in on any
        // input under 16px, and the candidate then has to pinch back out.
        className="block w-full max-w-full p-3 bg-[#1e1e1e] text-gray-200 font-mono text-base leading-relaxed resize-none outline-none disabled:opacity-50"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        aria-label="Code or logic answer"
      />

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize notepad"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => setHeight(limits.base)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); setHeight((h) => clamp(h - 40)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHeight((h) => clamp(h + 40)); }
        }}
        className="group flex h-5 cursor-ns-resize touch-none select-none items-center justify-center bg-[#252526] border-t border-[#3c3c3c] hover:bg-[#333] focus:outline-none focus:bg-[#333]"
        title="Drag to resize — double-click to reset"
      >
        <ChevronsUpDown size={12} className="text-gray-500 group-hover:text-gray-300" />
      </div>
    </div>
  );
}
