import { Badge } from '@/components/ui/Badge';
import { performanceLevel } from '@/utils/performance-level.utils';

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
  const level = performanceLevel(score);
  if (!level) return null;
  const text = reason?.trim() || (showMeaning ? level.meaning : '');

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={level.variant} size={size}>
          {level.label}
        </Badge>
        <span className="text-xs text-[var(--textTertiary)]">{score?.toFixed(1)} / 10</span>
      </div>
      {text && <p className="text-xs leading-relaxed text-[var(--textSecondary)]">{text}</p>}
    </div>
  );
}
