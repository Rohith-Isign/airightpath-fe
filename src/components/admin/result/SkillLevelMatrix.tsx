import { useMemo } from 'react';
import type { QuestionRow } from '@/utils/interview-questions.utils';
import type { VoiceEvaluationResult } from '@/types/interview.types';

const LEVELS = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
const LEVEL_NAMES: Record<(typeof LEVELS)[number], string> = {
  BASIC: 'Basic',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

interface Cell {
  asked: number;
  correct: number;
  judged: number;
  average: number | null;
}

function cellOf(rows: QuestionRow[]): Cell {
  const scored = rows.map((r) => r.score).filter((s): s is number => s != null);
  const judged = rows.filter((r) => r.correct != null);
  return {
    asked: rows.length,
    correct: judged.filter((r) => r.correct).length,
    judged: judged.length,
    average: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null,
  };
}

/**
 * Coverage and performance together, skill by skill and level by level: one row per skill, a column per level and one
 * for coding. Each cell says how many questions were asked there, how many were answered correctly and their average;
 * a level never reached says "Not assessed", which is coverage, not a score of zero. Built from the questions
 * themselves, so every number traces back to the answers in the transcript below.
 *
 * <p>A re-asked or corrected coding task is counted as a recovery attempt, not as another task.</p>
 */
export function SkillLevelMatrix({
  evaluation,
  rows,
}: Readonly<{ evaluation: VoiceEvaluationResult; rows: QuestionRow[] }>) {
  const skills = useMemo(() => {
    const fromReport = (evaluation.skillScores ?? []).map((s) => s.skill);
    const fromQuestions = rows.map((r) => r.skill).filter((s): s is string => !!s);
    return [...new Set([...fromReport, ...fromQuestions])];
  }, [evaluation.skillScores, rows]);

  if (skills.length === 0 || !rows.some((r) => r.skill)) return null;

  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, '');

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-[var(--text)]">Skill × level coverage</h4>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="bg-[var(--surface1)] text-xs uppercase tracking-wide text-[var(--textSecondary)]">
            <tr>
              <th className="px-3 py-2 font-semibold">Skill</th>
              {LEVELS.map((l) => (
                <th key={l} className="px-3 py-2 font-semibold">
                  {LEVEL_NAMES[l]}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">Coding tasks</th>
              <th className="px-3 py-2 font-semibold">Competencies tested</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const mine = rows.filter((r) => r.skill && key(r.skill) === key(skill));
              const codingTasks = mine.filter((r) => r.coding && !r.recovery);
              const recoveries = mine.filter((r) => r.coding && r.recovery).length;
              // Each competency once, in the order it was first tested.
              const competencies = [
                ...new Map(
                  mine
                    .map((r) => r.competency)
                    .filter((c): c is string => !!c)
                    .map((c) => [c.toLowerCase(), c] as const),
                ).values(),
              ];
              return (
                <tr key={skill} className="border-t border-[var(--border)] align-top">
                  <td className="px-3 py-2 font-medium text-[var(--text)]">{skill}</td>
                  {LEVELS.map((level) => {
                    const cell = cellOf(mine.filter((r) => r.level === level));
                    return (
                      <td key={level} className="px-3 py-2">
                        {cell.asked === 0 ? (
                          <span className="text-xs text-[var(--textTertiary)]">Not assessed</span>
                        ) : (
                          <span className="text-xs text-[var(--text)]">
                            {cell.judged ? `${cell.correct} of ${cell.judged} correct` : `${cell.asked} asked`}
                            {cell.average != null && (
                              <span className="block text-[var(--textSecondary)]">avg {cell.average.toFixed(1)}/10</span>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-xs">
                    {codingTasks.length === 0 ? (
                      <span className="text-[var(--textTertiary)]">None</span>
                    ) : (
                      <span className="text-[var(--text)]">
                        {codingTasks.length} task{codingTasks.length === 1 ? '' : 's'}
                        {recoveries > 0 && (
                          <span className="block text-[var(--textSecondary)]">
                            + {recoveries} correction attempt{recoveries === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--textSecondary)]">
                    {competencies.length ? competencies.join(', ') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--textTertiary)]">
        Correct means rated 6/10 or more (a reviewer’s score counts where one was given). “Not assessed” is a level the
        interview never reached: it shows coverage, not a score of zero.
      </p>
    </div>
  );
}
