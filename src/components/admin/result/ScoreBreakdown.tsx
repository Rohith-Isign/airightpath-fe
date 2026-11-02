import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { SummaryStat } from '@/components/admin/result/ResultPrimitives';
import { performanceLevel, type PerformanceLevel } from '@/utils/performance-level.utils';
import type { VoiceConversationEntryDTO } from '@/services/interview.service';
import type { VoiceEvaluationResult } from '@/types/interview.types';

const SKIPPED = '[NO RESPONSE - SKIPPED]';
/** An area at or under this is called out as somewhere the candidate fell short. */
const WEAK_BELOW = 6;

/**
 * Shows how an interview's number was arrived at, so a reviewer is not asked to take "4.0 / 10" on trust.
 *
 * <p>It lays out what was asked and answered, how each answer was rated, and how the areas combine into the
 * overall score, then names the areas that held the score down and what to do about them. Every figure is read from
 * the stored evaluation and transcript; nothing here is recomputed with a different rule.</p>
 */
export function ScoreBreakdown({
  evaluation,
  transcript,
}: Readonly<{ evaluation: VoiceEvaluationResult; transcript: VoiceConversationEntryDTO[] }>) {
  const [showAnswers, setShowAnswers] = useState(false);

  const counts = useMemo(() => {
    const asked = transcript.filter((e) => e.role === 'INTERVIEWER').length;
    const candidateTurns = transcript.filter((e) => e.role === 'CANDIDATE');
    const skipped = candidateTurns.filter((e) => e.content?.trim() === SKIPPED).length;
    const rated = candidateTurns.filter((e) => e.answerScore != null);
    const average = rated.length
      ? rated.reduce((sum, e) => sum + (e.answerScore ?? 0), 0) / rated.length
      : null;
    const byLevel = new Map<string, { count: number; variant: PerformanceLevel['variant'] }>();
    rated.forEach((e) => {
      const level = performanceLevel(e.answerScore);
      if (!level) return;
      const entry = byLevel.get(level.label) ?? { count: 0, variant: level.variant };
      entry.count += 1;
      byLevel.set(level.label, entry);
    });
    return { asked, answered: candidateTurns.length - skipped, skipped, average, byLevel };
  }, [transcript]);

  /** Question and the answer given to it, in order, with the rating the interviewer gave. */
  const answers = useMemo(() => {
    const rows: { question: string; answer: string; score: number | null; skipped: boolean }[] = [];
    let lastQuestion = '';
    transcript.forEach((entry) => {
      if (entry.role === 'INTERVIEWER') lastQuestion = entry.content ?? '';
      if (entry.role === 'CANDIDATE') {
        rows.push({
          question: lastQuestion,
          answer: entry.content ?? '',
          score: entry.answerScore ?? null,
          skipped: entry.content?.trim() === SKIPPED,
        });
      }
    });
    return rows;
  }, [transcript]);

  const areas = evaluation.categoryScores ?? [];
  // Weights are stored as shares of one for new evaluations and as the model echoed them for older ones, so both
  // are read as proportions of their own total.
  const totalWeight = areas.reduce((sum, a) => sum + (a.weight || 0), 0);
  const share = (weight: number) => (totalWeight > 0 ? weight / totalWeight : 0);
  const weakest = [...areas]
    .filter((a) => (a.score ?? 0) < WEAK_BELOW)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat value={counts.asked} label="Questions asked" tone="info" />
        <SummaryStat value={counts.answered} label="Answered" tone="success" />
        <SummaryStat value={counts.skipped} label="Skipped" tone="warning" />
        <SummaryStat
          value={counts.average == null ? '--' : counts.average.toFixed(1)}
          label="Avg answer score"
          tone="primary"
          hint="Mean of the interviewer's rating of each answer, out of 10"
        />
      </div>

      {counts.byLevel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--textTertiary)]">
            How the answers were rated
          </span>
          {[...counts.byLevel.entries()].map(([label, { count, variant }]) => (
            <Badge key={label} variant={variant} size="sm">
              {count} × {label}
            </Badge>
          ))}
        </div>
      )}

      {areas.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--textTertiary)]">
            How the overall score is built
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface1)] text-[var(--textTertiary)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Area</th>
                  <th className="px-3 py-2 font-semibold">Weight</th>
                  <th className="px-3 py-2 font-semibold">Score</th>
                  <th className="px-3 py-2 font-semibold">Level</th>
                  <th className="px-3 py-2 text-right font-semibold">Adds to overall</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => {
                  const level = performanceLevel(area.score);
                  const points = (area.score ?? 0) * share(area.weight || 0);
                  return (
                    <tr key={area.category} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2 font-medium text-[var(--text)]">{area.category}</td>
                      <td className="px-3 py-2 text-[var(--textSecondary)]">
                        {Math.round(share(area.weight || 0) * 100)}%
                      </td>
                      <td className="px-3 py-2 text-[var(--textSecondary)]">{area.score}/10</td>
                      <td className="px-3 py-2">
                        {level && (
                          <Badge variant={level.variant} size="sm">
                            {level.label}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[var(--text)]">
                        {points.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-[var(--border)] bg-[var(--surface1)]">
                  <td className="px-3 py-2 font-semibold text-[var(--text)]" colSpan={4}>
                    Overall
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-[var(--text)]">
                    {evaluation.overallScore.toFixed(1)} / 10
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-[var(--textTertiary)]">
            Overall = the sum of each area&apos;s score × its share of the total weight. Weights are the ones set for
            this round on the Manage AI Prompts page, taken as shares of their total.
          </p>
        </div>
      )}

      {weakest.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface1)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--text)]">Where the candidate fell short</p>
          <ul className="space-y-2.5">
            {weakest.map((area) => (
              <li key={area.category} className="text-xs leading-relaxed text-[var(--textSecondary)]">
                <span className="font-semibold text-[var(--text)]">
                  {area.category} ({area.score}/10):
                </span>{' '}
                {area.feedback || 'No detail was recorded for this area.'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {answers.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAnswers((open) => !open)}
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            <ChevronDown size={15} className={`transition-transform ${showAnswers ? 'rotate-180' : ''}`} />
            {showAnswers ? 'Hide' : 'Show'} answer-by-answer scores ({answers.length})
          </button>
          {showAnswers && (
            <ol className="mt-3 space-y-2">
              {answers.map((row, index) => {
                const level = performanceLevel(row.score);
                return (
                  <li
                    key={`${index}-${row.question.slice(0, 20)}`}
                    className="rounded-lg border border-[var(--border)] p-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium text-[var(--text)]">
                        {index + 1}. {row.question || 'Question'}
                      </p>
                      <span className="flex-shrink-0">
                        {row.skipped ? (
                          <Badge variant="warning" size="sm">
                            Skipped
                          </Badge>
                        ) : level ? (
                          <Badge variant={level.variant} size="sm">
                            {level.label} · {row.score?.toFixed(0)}/10
                          </Badge>
                        ) : (
                          <Badge variant="default" size="sm">
                            Not rated
                          </Badge>
                        )}
                      </span>
                    </div>
                    {!row.skipped && (
                      <p className="mt-1.5 line-clamp-3 text-[var(--textSecondary)]">{row.answer}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

