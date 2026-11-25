import type { VoiceEvaluationResult } from '@/types/interview.types';

type Requirement = NonNullable<VoiceEvaluationResult['expectedConcepts']>[number];

/** Core requirements count double, the same weighting the server scores with. */
const weightOf = (r: Requirement) => (r.importance === 'CORE' ? 2 : 1);
const creditOf = (r: Requirement) => (r.status === 'CORRECT' ? 1 : r.status === 'PARTIAL' ? 0.5 : 0);

const STATUS: Record<Requirement['status'], { label: string; className: string }> = {
  CORRECT: { label: 'Shown', className: 'text-[var(--success)]' },
  PARTIAL: { label: 'Partly shown', className: 'text-[var(--warning)]' },
  INCORRECT: { label: 'Not shown', className: 'text-[var(--error)]' },
  NOT_ASKED: { label: 'Not reached', className: 'text-[var(--textTertiary)]' },
};

const KIND: Record<string, string> = { SKILL: 'Skill', RESPONSIBILITY: 'Responsibility', EXPERIENCE: 'Experience depth' };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * How the overall percentage was worked out, in terms a recruiter can explain to the candidate.
 *
 * <p>The overall score is the share of the role's requirements the candidate showed: each requirement is worth a
 * point (a core one two), earned in full when shown, half when partly shown, nothing when not shown or never reached.
 * This lays that out: the sum, where the rest of the marks were lost, and for each requirement what it earned and,
 * from the notes on its answers, what was missing.</p>
 */
export function ScoreExplanation({ evaluation }: Readonly<{ evaluation: VoiceEvaluationResult }>) {
  const requirements = evaluation.expectedConcepts ?? [];
  if (requirements.length === 0) return null;

  const total = requirements.reduce((sum, r) => sum + weightOf(r), 0);
  const earned = requirements.reduce((sum, r) => sum + weightOf(r) * creditOf(r), 0);
  const percent = total > 0 ? Math.round((earned / total) * 100) : 0;

  const lostBy = (status: Requirement['status']) =>
    requirements
      .filter((r) => r.status === status)
      .reduce((sum, r) => sum + weightOf(r) * (1 - creditOf(r)), 0);
  const losses = [
    { status: 'NOT_ASKED' as const, title: 'Not reached in the interview', points: lostBy('NOT_ASKED') },
    { status: 'INCORRECT' as const, title: 'Asked, but not shown', points: lostBy('INCORRECT') },
    { status: 'PARTIAL' as const, title: 'Only partly shown (half the marks lost)', points: lostBy('PARTIAL') },
  ].filter((l) => l.points > 0);

  const missedFor = (r: Requirement) =>
    (r.questionNumbers ?? [])
      .map((q) => evaluation.answerNotes?.find((n) => n.questionNumber === q))
      .filter((n): n is NonNullable<typeof n> => !!n && !!n.missed?.trim())
      .map((n) => `Q${n.questionNumber}: ${n.missed}`);

  // Weakest first: where the marks went is what needs explaining.
  const ordered = [...requirements].sort(
    (a, b) => creditOf(a) - creditOf(b) || weightOf(b) - weightOf(a),
  );

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      <div>
        <h5 className="text-sm font-semibold text-[var(--text)]">How the {percent}% was worked out</h5>
        <p className="mt-1 text-sm text-[var(--textSecondary)]">
          The score is measured against everything this role needs, not only the questions that were asked. The role
          has {requirements.length} requirements worth {fmt(total)} points (core requirements count double). A
          requirement earns its full points when shown, half when partly shown, and nothing when not shown or never
          reached. The candidate earned <strong>{fmt(earned)}</strong> of <strong>{fmt(total)}</strong> points ={' '}
          <strong>{percent}%</strong>.
        </p>
      </div>

      {losses.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--textTertiary)]">
            Where the other {100 - percent}% was lost
          </p>
          <ul className="space-y-1 text-sm">
            {losses.map((l) => (
              <li key={l.status} className="flex items-baseline justify-between gap-3">
                <span className={STATUS[l.status].className}>{l.title}</span>
                <span className="shrink-0 font-medium text-[var(--text)]">
                  −{fmt(l.points)} pts ({Math.round((l.points / total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-[var(--primary)]">
          Requirement by requirement ({requirements.length})
        </summary>
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {ordered.map((r) => {
            const status = STATUS[r.status] ?? STATUS.NOT_ASKED;
            const missed = missedFor(r);
            return (
              <li key={`${r.concept}-${r.skill ?? ''}`} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0 text-[var(--text)]">
                    {r.importance === 'CORE' && (
                      <span className="mr-1.5 rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--primary)]">
                        Core
                      </span>
                    )}
                    {r.concept}
                    <span className="ml-1.5 text-xs text-[var(--textTertiary)]">
                      {KIND[r.requirement ?? 'SKILL'] ?? 'Skill'}
                      {r.skill ? ` · ${r.skill}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs">
                    <span className={`font-semibold ${status.className}`}>{status.label}</span>
                    <span className="ml-2 text-[var(--textSecondary)]">
                      {fmt(weightOf(r) * creditOf(r))}/{weightOf(r)} pts
                    </span>
                  </span>
                </div>
                {r.questionNumbers && r.questionNumbers.length > 0 && (
                  <p className="mt-0.5 text-xs text-[var(--textTertiary)]">
                    From question{r.questionNumbers.length > 1 ? 's' : ''} {r.questionNumbers.map((q) => `Q${q}`).join(', ')}
                  </p>
                )}
                {r.status === 'NOT_ASKED' && (
                  <p className="mt-0.5 text-xs text-[var(--textSecondary)]">
                    No question in this interview reached it, so it earned nothing.
                  </p>
                )}
                {missed.length > 0 && r.status !== 'CORRECT' && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-[var(--textSecondary)]">
                    {missed.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
