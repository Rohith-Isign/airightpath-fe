import { Badge } from '@/components/ui/Badge';
import type { VoiceEvaluationResult } from '@/types/interview.types';

/**
 * The grader's verdict as a senior interviewer would give it: what kind of candidate this is, the level they actually
 * showed against the level the job asks for, what the interview never tested, and where answers were right but not
 * deep enough. Read first, because it is the decision; the scores below are the evidence for it.
 *
 * <p>Shows nothing for an evaluation graded before the verdict was asked for.</p>
 */
export function HiringVerdict({ evaluation }: Readonly<{ evaluation: VoiceEvaluationResult }>) {
  const notCovered = evaluation.notCovered ?? [];
  const depthGaps = evaluation.depthGaps ?? [];
  if (!evaluation.verdict && !evaluation.observedSeniority && !notCovered.length && !depthGaps.length) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface1)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--text)]">Hiring verdict</h4>
        {evaluation.observedSeniority && (
          <Badge variant="primary" size="md">
            Level shown: {evaluation.observedSeniority}
          </Badge>
        )}
      </div>
      {evaluation.verdict && (
        <p className="text-sm leading-relaxed text-[var(--text)]">{evaluation.verdict}</p>
      )}
      {(notCovered.length > 0 || depthGaps.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {notCovered.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                Not covered in this interview
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-[var(--textSecondary)]">
                {notCovered.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {depthGaps.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--error)]">
                Right, but not deep enough
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-[var(--textSecondary)]">
                {depthGaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
