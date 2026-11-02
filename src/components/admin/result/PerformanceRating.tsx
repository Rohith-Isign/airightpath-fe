import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { performanceLevel } from '@/utils/performance-level.utils';

/** Longer than this and the reason is folded behind "Show more". */
const FOLD_AFTER = 170;

/**
 * A score as a named level with the reason behind it, so an admin can see at a glance who performed best
 * and why without working it out from the number.
 */
export function PerformanceRating({
  score,
  reason,
  size = 'sm',
  showMeaning = false,
}: Readonly<{
  /** 0-10. */
  score: number | null | undefined;
  /** The grader's own explanation for this score. */
  reason?: string | null;
  size?: 'sm' | 'md';
  /** Adds what the band means when the grader gave no reason of its own. */
  showMeaning?: boolean;
}>) {
  const [expanded, setExpanded] = useState(false);
  const level = performanceLevel(score);
  if (!level) return null;
  const text = reason?.trim() || (showMeaning ? level.meaning : '');
  const folded = text.length > FOLD_AFTER && !expanded;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={level.variant} size={size}>
          {level.label}
        </Badge>
        <span className="text-xs text-[var(--textTertiary)]">{score?.toFixed(1)} / 10</span>
      </div>
      {text && (
        <p className="text-xs leading-relaxed text-[var(--textSecondary)]">
          {folded ? `${text.slice(0, FOLD_AFTER).trimEnd()}…` : text}
          {text.length > FOLD_AFTER && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              className="ml-1 font-semibold text-[var(--primary)] hover:underline"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
