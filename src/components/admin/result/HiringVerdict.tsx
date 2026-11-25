import { Badge } from '@/components/ui/Badge';
import type { VoiceEvaluationResult } from '@/types/interview.types';
import { ScoreExplanation } from './ScoreExplanation';

/**
 * Why the candidate passed or failed, against the role: the role fit next to the pass mark and the core skills not
 * shown. The full working, requirement by requirement, is in ScoreExplanation. A recruiter asked "62%
 * and failed: what is the threshold?"; this answers it on the page.
 */
function RoleFit({ evaluation }: Readonly<{ evaluation: VoiceEvaluationResult }>) {
  if (evaluation.resultReason == null) return null;
  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface2,var(--surface1))] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={evaluation.meetsPassMark ? 'success' : 'error'} size="md">
          {evaluation.meetsPassMark ? 'Meets the role' : 'Does not meet the role'}
        </Badge>
        {evaluation.passMark != null && (
          <span className="text-xs text-[var(--textSecondary)]">Pass mark {Math.round(evaluation.passMark)}% of the role</span>
        )}
      </div>
      <p className="text-sm text-[var(--text)]">{evaluation.resultReason}</p>
    </div>
  );
}

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
  if (!evaluation.verdict && !evaluation.observedSeniority && !notCovered.length && !depthGaps.length
      && evaluation.resultReason == null && !evaluation.expectedConcepts?.length) return null;

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
      <RoleFit evaluation={evaluation} />
      <ScoreExplanation evaluation={evaluation} />
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
