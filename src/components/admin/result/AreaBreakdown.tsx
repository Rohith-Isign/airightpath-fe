import { useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { QuestionRow } from '@/utils/interview-questions.utils';
import { areaLabel } from '@/utils/interview-areas.utils';
import type { VoiceEvaluationResult } from '@/types/interview.types';



const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'secondary' }> = {
  CORRECT: { label: 'Correct', variant: 'success' },
  PARTIAL: { label: 'Partly', variant: 'warning' },
  INCORRECT: { label: 'Not correct', variant: 'error' },
  NOT_ASKED: { label: 'Not asked', variant: 'secondary' },
};


interface AreaRow {
  area: string;
  asked: number;
  answered: number;
  correct: number;
  judged: number;
  average: number | null;
  conceptsExpected: number;
  conceptsReached: number;
  conceptsEarned: number;
}

/**
 * Where the interview went, area by area, and how much of what it should have covered it reached.
 *
 * <p>Two sources, both from the grader: the area of every question asked, and the full list of concepts a complete
 * interview for this role should have tested, each marked correct, partly, not correct or not asked. The table shows,
 * per area, how many questions were asked and answered and how they were rated, next to how many of that area's
 * expected concepts were reached. The list below it names every concept, so a reviewer can see exactly what was never
 * asked as well as what was got wrong.</p>
 *
 * <p>Shows nothing for an evaluation graded before areas and concepts were recorded.</p>
 */
export function AreaBreakdown({
  evaluation,
  rows,
}: Readonly<{ evaluation: VoiceEvaluationResult; rows: QuestionRow[] }>) {
  const concepts = useMemo(() => evaluation.expectedConcepts ?? [], [evaluation.expectedConcepts]);
  const questionAreas = useMemo(() => evaluation.questionAreas ?? [], [evaluation.questionAreas]);

  const table = useMemo(() => {
    const byArea = new Map<string, AreaRow>();
    const row = (area: string) => {
      let r = byArea.get(area);
      if (!r) {
        r = {
          area,
          asked: 0,
          answered: 0,
          correct: 0,
          judged: 0,
          average: null,
          conceptsExpected: 0,
          conceptsReached: 0,
          conceptsEarned: 0,
        };
        byArea.set(area, r);
      }
      return r;
    };
    const scores = new Map<string, number[]>();
    questionAreas.forEach(({ questionNumber, area }) => {
      const q = rows.find((r) => r.number === questionNumber);
      const r = row(area);
      r.asked += 1;
      if (q?.answered) r.answered += 1;
      if (q?.correct != null) {
        r.judged += 1;
        if (q.correct) r.correct += 1;
      }
      if (q?.score != null) scores.set(area, [...(scores.get(area) ?? []), q.score]);
    });
    scores.forEach((list, area) => {
      row(area).average = list.reduce((sum, s) => sum + s, 0) / list.length;
    });
    concepts.forEach((c) => {
      const r = row(c.area);
      r.conceptsExpected += 1;
      if (c.status !== 'NOT_ASKED') r.conceptsReached += 1;
      if (c.status === 'CORRECT') r.conceptsEarned += 1;
      else if (c.status === 'PARTIAL') r.conceptsEarned += 0.5;
    });
    return [...byArea.values()].sort(
      (a, b) => b.conceptsExpected - a.conceptsExpected || b.asked - a.asked,
    );
  }, [concepts, questionAreas, rows]);

  if (concepts.length === 0 && questionAreas.length === 0) return null;

  const reached = concepts.filter((c) => c.status !== 'NOT_ASKED').length;
  const conceptsByArea = table
    .map((r) => ({ area: r.area, items: concepts.filter((c) => c.area === r.area) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-[var(--text)]">Coverage by area</h4>
        {evaluation.scopeScore != null && (
          <p className="text-xs text-[var(--textSecondary)]">
            Score against the full scope:{' '}
            <span className="font-semibold text-[var(--text)]">{Math.round(evaluation.scopeScore)}/100</span>
            {' · '}
            {reached} of {concepts.length} expected concepts reached
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-[var(--surface1)] text-xs uppercase tracking-wide text-[var(--textSecondary)]">
            <tr>
              <th className="px-3 py-2 font-semibold">Area</th>
              <th className="px-3 py-2 text-right font-semibold">Questions</th>
              <th className="px-3 py-2 text-right font-semibold">Answered</th>
              <th className="px-3 py-2 text-right font-semibold">Correct</th>
              <th className="px-3 py-2 text-right font-semibold">Avg answer</th>
              <th className="px-3 py-2 text-right font-semibold">Concepts reached</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) => (
              <tr key={r.area} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-medium text-[var(--text)]">{areaLabel(r.area)}</td>
                <td className="px-3 py-2 text-right">{r.asked}</td>
                <td className="px-3 py-2 text-right">{r.answered}</td>
                <td className="px-3 py-2 text-right">{r.judged ? `${r.correct} of ${r.judged}` : '—'}</td>
                <td className="px-3 py-2 text-right">{r.average != null ? `${r.average.toFixed(1)}/10` : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {r.conceptsExpected ? (
                    <span className={r.conceptsReached < r.conceptsExpected ? 'font-semibold text-[var(--warning)]' : ''}>
                      {r.conceptsReached} of {r.conceptsExpected}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {conceptsByArea.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--textSecondary)]">
            Every concept a complete interview for this role should have tested. A concept marked “Not asked” was never
            reached and earns nothing, so the score reflects the whole job, not only the questions that happened to be
            asked.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {conceptsByArea.map((group) => (
              <div key={group.area} className="rounded-xl border border-[var(--border)] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--textSecondary)]">
                  {areaLabel(group.area)}
                </p>
                <ul className="space-y-1.5">
                  {group.items.map((c) => (
                    <li key={c.concept} className="flex items-start justify-between gap-2 text-sm">
                      <span className="min-w-0 text-[var(--text)]">
                        {c.concept}
                        {c.questionNumbers && c.questionNumbers.length > 0 && (
                          <span className="ml-1 text-xs text-[var(--textTertiary)]">
                            (Q{c.questionNumbers.join(', Q')})
                          </span>
                        )}
                      </span>
                      <Badge variant={STATUS[c.status]?.variant ?? 'secondary'} size="sm">
                        {STATUS[c.status]?.label ?? c.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
