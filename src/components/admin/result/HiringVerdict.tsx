import { Badge } from '@/components/ui/Badge';
import type { VoiceEvaluationResult } from '@/types/interview.types';

/**
 * The grader's verdict as a senior interviewer would give it: what kind of candidate this is, the level they actually
 * showed against the level the job asks for, what the interview never tested, and where answers were right but not
 * deep enough. Read first, because it is the decision; the scores below are the evidence for it.
 *
 * <p>Shows nothing for an evaluation graded before the verdict was asked for.</p>
 */
const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  CORRECT: { label: 'Shown', className: 'text-[var(--success)]' },
  PARTIAL: { label: 'Partly shown', className: 'text-[var(--warning)]' },
  INCORRECT: { label: 'Not shown', className: 'text-[var(--error)]' },
  NOT_ASKED: { label: 'Not reached', className: 'text-[var(--textTertiary)]' },
};

const REQUIREMENT_LABEL: Record<string, string> = {
  SKILL: 'Skill',
  RESPONSIBILITY: 'Responsibility',
  EXPERIENCE: 'Experience depth',
};

/**
 * Why the candidate passed or failed, against the role: the role fit next to the pass mark, the core skills not
 * shown, and every requirement of the role with how the candidate did on it, core ones first. A recruiter asked "62%
 * and failed: what is the threshold?"; this answers it on the page.
 */
function RoleFit({ evaluation }: Readonly<{ evaluation: VoiceEvaluationResult }>) {
  if (evaluation.resultReason == null) return null;
  const requirements = [...(evaluation.expectedConcepts ?? [])]
    .filter((c) => c.requirement != null)
    .sort((a, b) => (a.importance === 'CORE' ? 0 : 1) - (b.importance === 'CORE' ? 0 : 1));
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
      {requirements.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-[var(--primary)]">
            Role requirements ({requirements.length})
          </summary>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {requirements.map((c) => {
              const status = STATUS_LABEL[c.status] ?? STATUS_LABEL.NOT_ASKED;
              return (
                <li key={`${c.concept}-${c.skill ?? ''}`} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                  <span className="min-w-0 text-[var(--text)]">
                    {c.importance === 'CORE' && (
                      <span className="mr-1.5 rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--primary)]">
                        Core
                      </span>
                    )}
                    {c.concept}
                    <span className="ml-1.5 text-xs text-[var(--textTertiary)]">
                      {REQUIREMENT_LABEL[c.requirement ?? 'SKILL']}
                      {c.skill ? ` · ${c.skill}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${status.className}`}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

export function HiringVerdict({ evaluation }: Readonly<{ evaluation: VoiceEvaluationResult }>) {
  const notCovered = evaluation.notCovered ?? [];
  const depthGaps = evaluation.depthGaps ?? [];
  if (!evaluation.verdict && !evaluation.observedSeniority && !notCovered.length && !depthGaps.length
      && evaluation.resultReason == null) return null;

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
