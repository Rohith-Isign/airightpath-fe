import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { STRINGS } from '@/constants/strings';
import { performanceLevel } from '@/utils/performance-level.utils';
import type { QuestionRow } from '@/utils/interview-questions.utils';

/**
 * How many questions one area's score rests on, how many were answered, and which they were.
 *
 * <p>The numbers come from the grader, which says for each area which of the interviewer's questions it drew on.
 * Shows nothing for an evaluation graded before that was recorded, rather than guessing from the topic labels.</p>
 */
export function AreaQuestions({
  numbers,
  rows,
}: Readonly<{ numbers: number[] | null | undefined; rows: QuestionRow[] }>) {
  const [open, setOpen] = useState(false);
  if (!numbers) return null;

  const matched = numbers
    .map((number) => rows.find((row) => row.number === number))
    .filter((row): row is QuestionRow => row !== undefined);
  const S = STRINGS.scoreBreakdown;

  if (matched.length === 0) {
    return <p className="text-xs text-[var(--textTertiary)]">{S.areaNoQuestions}</p>;
  }

  const answered = matched.filter((row) => row.answered).length;
  const skipped = matched.filter((row) => row.skipped).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--textSecondary)]">
        <span className="font-semibold text-[var(--text)]">{S.areaBasedOn(matched.length)}</span>
        <span>{S.areaAnswered(answered)}</span>
        {skipped > 0 && <span>{S.areaSkipped(skipped)}</span>}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline"
        >
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? S.hideQuestions : S.showQuestions}
        </button>
      </div>
      {open && (
        <ol className="space-y-2">
          {matched.map((row) => {
            const level = performanceLevel(row.score);
            return (
              <li key={row.number} className="rounded-lg border border-[var(--border)] p-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-medium text-[var(--text)]">
                    {row.number}. {row.question}
                  </p>
                  <span className="flex-shrink-0">
                    {row.skipped && (
                      <Badge variant="warning" size="sm">
                        {S.skipped}
                      </Badge>
                    )}
                    {!row.skipped && level && (
                      <Badge variant={level.variant} size="sm">
                        {level.label} · {row.score?.toFixed(0)}/10
                      </Badge>
                    )}
                    {!row.skipped && !level && (
                      <Badge variant="default" size="sm">
                        {S.notRated}
                      </Badge>
                    )}
                  </span>
                </div>
                {row.answered && <p className="mt-1.5 line-clamp-3 text-[var(--textSecondary)]">{row.answer}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
