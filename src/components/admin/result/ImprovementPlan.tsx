import { Badge } from '@/components/ui/Badge';
import type { VoiceEvaluationResult } from '@/types/interview.types';

const PRIORITY: Record<string, { label: string; variant: 'error' | 'warning' | 'secondary' }> = {
  HIGH: { label: 'High priority', variant: 'error' },
  MEDIUM: { label: 'Medium', variant: 'warning' },
  LOW: { label: 'Low', variant: 'secondary' },
};

/**
 * Where the candidate can improve, as concrete next steps: for each weak or untested area, what fell short in this
 * interview and what to study and practise to close it, most important first. The last thing on the result, because it
 * is what comes after the decision: feedback to the candidate, or the focus of a next round.
 *
 * <p>Shows nothing for an evaluation graded before the plan was asked for.</p>
 */
export function ImprovementPlan({ evaluation }: Readonly<{ evaluation: VoiceEvaluationResult }>) {
  const items = evaluation.improvementPlan ?? [];
  if (items.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4">
      <div>
        <h4 className="text-sm font-semibold text-[var(--text)]">How to improve</h4>
        <p className="text-xs text-[var(--textSecondary)]">
          Concrete next steps from this interview, most important first.
        </p>
      </div>
      <ol className="space-y-2">
        {items.map((item, index) => {
          const priority = PRIORITY[item.priority ?? 'MEDIUM'] ?? PRIORITY.MEDIUM;
          return (
            <li key={`${item.skill}-${index}`} className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">
                  {index + 1}. {item.skill || 'General'}
                </span>
                <Badge variant={priority.variant} size="sm">
                  {priority.label}
                </Badge>
              </div>
              {item.gap && (
                <p className="text-sm text-[var(--textSecondary)]">
                  <span className="font-semibold text-[var(--text)]">Gap: </span>
                  {item.gap}
                </p>
              )}
              <p className="mt-1 text-sm text-[var(--textSecondary)]">
                <span className="font-semibold text-[var(--text)]">What to do: </span>
                {item.action}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
