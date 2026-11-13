import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { STRINGS } from '@/constants/strings';
import { PerformanceRating } from '@/components/admin/result/PerformanceRating';
import { AreaQuestions } from '@/components/admin/result/AreaQuestions';
import { SkillBar } from '@/components/admin/result/ResultPrimitives';
import { l2Category, toPercent } from '@/utils/l2-category.utils';
import type { QuestionRow } from '@/utils/interview-questions.utils';
import type { TechnicalLevel, VoiceCategoryScore, VoiceEvaluationResult } from '@/types/interview.types';

const T = STRINGS.technicalReport;

const LEVELS: Exclude<TechnicalLevel, 'NONE'>[] = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

/** 0 for none or unknown, 1..4 for Basic..Expert. */
function levelRank(level: TechnicalLevel | null | undefined): number {
  const index = level ? LEVELS.indexOf(level as Exclude<TechnicalLevel, 'NONE'>) : -1;
  return index + 1;
}

/** Weights arrive as a share (0.22) from the grader, or as a percentage on older results. */
function weightLabel(weight: number): string {
  const percent = weight <= 1 ? weight * 100 : weight;
  return `${Math.round(percent)}%`;
}

function isAssessed(category: VoiceCategoryScore): boolean {
  return category.assessed !== false;
}

/** Four steps, filled up to the level reached. Reads at a glance in a list and in the detail. */
function LevelSteps({
  level,
  size = 'sm',
}: Readonly<{ level: TechnicalLevel | null | undefined; size?: 'sm' | 'lg' }>) {
  const reached = levelRank(level);
  const label = level && level !== 'NONE' ? T.levelNames[level] : T.levelNames.NONE;
  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={`${T.highestLevel}: ${label}`}
    >
      {LEVELS.map((name, index) => {
        const filled = index < reached;
        return (
          <span
            key={name}
            title={`${T.levelNames[name]}: ${filled ? T.reached : T.notReached}`}
            className={`${size === 'lg' ? 'h-2.5' : 'h-1.5'} flex-1 rounded-full ${
              filled ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
            }`}
          />
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  badge,
}: Readonly<{ label: string; value: string; hint?: string; badge?: React.ReactNode }>) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface1)] p-3" title={hint}>
      <p className="text-xs font-medium text-[var(--textSecondary)]">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-tight text-[var(--text)]">{value}</p>
      {badge && <div className="mt-1.5">{badge}</div>}
    </div>
  );
}

/** One domain in the list: name, score, level steps and whether the resume showed it. */
function DomainRow({
  category,
  selected,
  onSelect,
  hasLevels,
}: Readonly<{
  category: VoiceCategoryScore;
  selected: boolean;
  onSelect: () => void;
  hasLevels: boolean;
}>) {
  const assessed = isAssessed(category);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
        selected
          ? 'border-[var(--primary)] bg-[var(--primaryMuted,var(--surface1))]'
          : 'border-[var(--border)] bg-[var(--cardBg,var(--surface1))] hover:bg-[var(--surface1)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold text-[var(--text)]">{category.category}</p>
        {assessed ? (
          <span className="flex-shrink-0 text-sm font-semibold text-[var(--text)]">
            {category.score}
            <span className="text-xs font-normal text-[var(--textTertiary)]">/10</span>
          </span>
        ) : (
          <Badge variant="default" size="sm">
            {T.notAssessed}
          </Badge>
        )}
      </div>
      {assessed && hasLevels && (
        <div className="mt-2">
          <LevelSteps level={category.highestLevel} />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--textSecondary)]">
        <span>
          {T.weight} {weightLabel(category.weight)}
        </span>
        {category.mapped != null && (
          <Badge variant={category.mapped ? 'primary' : 'secondary'} size="sm">
            {category.mapped ? T.mapped : T.unmapped}
          </Badge>
        )}
      </div>
    </button>
  );
}

function DomainDetail({
  category,
  rows,
  hasLevels,
}: Readonly<{ category: VoiceCategoryScore; rows: QuestionRow[]; hasLevels: boolean }>) {
  const assessed = isAssessed(category);
  const reached = levelRank(category.highestLevel);

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-base font-semibold text-[var(--text)]">{category.category}</h4>
        <Badge variant="default" size="sm">
          {T.weight} {weightLabel(category.weight)}
        </Badge>
        {category.mapped != null && (
          <span title={category.mapped ? T.mappedHint : T.unmappedHint}>
            <Badge variant={category.mapped ? 'primary' : 'secondary'} size="sm">
              {category.mapped ? T.mapped : T.unmapped}
            </Badge>
          </span>
        )}
      </div>

      {assessed ? (
        <>
          <SkillBar
            label={T.scoreOutOf(category.score)}
            // Category scores are 0-10; SkillBar draws a percentage.
            percentage={Math.round((category.score ?? 0) * 10)}
          />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--textSecondary)]">
              {T.levels}
            </p>
            {hasLevels ? (
              <>
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {LEVELS.map((name, index) => {
                    const filled = index < reached;
                    return (
                      <li
                        key={name}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          filled
                            ? 'border-[var(--primary)] bg-[var(--primaryMuted,var(--surface1))] text-[var(--text)]'
                            : 'border-dashed border-[var(--border)] text-[var(--textSecondary)]'
                        }`}
                      >
                        {filled ? (
                          <Check size={14} className="flex-shrink-0 text-[var(--primary)]" />
                        ) : (
                          <CircleDashed size={14} className="flex-shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block font-medium">{T.levelNames[name]}</span>
                          <span className="block text-xs">{filled ? T.reached : T.notReached}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-xs text-[var(--textTertiary)]">{T.levelsNote}</p>
              </>
            ) : (
              <p className="text-xs text-[var(--textTertiary)]">{T.levelNotRecorded}</p>
            )}
          </div>

          <PerformanceRating score={category.score} reason={category.feedback} showMeaning />
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-sm text-[var(--textSecondary)]">
          {T.notAssessedDetail}
        </p>
      )}

      <AreaQuestions numbers={category.questionNumbers} rows={rows} />
    </div>
  );
}

/**
 * The L2 result, led by the verdict and then the domains.
 *
 * <p>A reviewer comes here to answer "should this person go forward, and how sure are we", so that is the top of
 * the page: the score, how much of the role was actually tested, how sure the grader was, and how far the candidate
 * got. Performance, coverage and confidence are three separate numbers on purpose; a high score over thin coverage
 * must not read as a strong candidate. Below that, one domain at a time: pick it from the list, read its levels,
 * feedback and the questions it rests on.</p>
 *
 * <p>An area no question reached is shown as not assessed, never as zero, and a level the candidate did not show is
 * "not shown", never "failed".</p>
 */
export function TechnicalDomainReport({
  evaluation,
  rows,
}: Readonly<{ evaluation: VoiceEvaluationResult; rows: QuestionRow[] }>) {
  const categories = evaluation.categoryScores;

  // Assessed first, in the order the grader gave; areas never reached sink to the bottom of the list.
  const ordered = useMemo(
    () => [...categories].sort((a, b) => Number(isAssessed(b)) - Number(isAssessed(a))),
    [categories],
  );
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = ordered.find((c) => c.category === selectedName) ?? ordered[0];

  const assessedCount = categories.filter(isAssessed).length;
  const hasLevels = categories.some((c) => c.highestLevel != null);
  const best = categories.reduce((top, c) => Math.max(top, levelRank(c.highestLevel)), 0);
  const overallPercent = toPercent(evaluation.overallScore);
  // Falls back to the overall when the grader gave no assessed-only figure (older results): everything was
  // treated as tested there, so the two are the same number.
  const technicalPercent = toPercent(evaluation.assessedScore ?? evaluation.overallScore);
  const category = l2Category(overallPercent);
  const bestLabel = best > 0 ? T.levelNames[LEVELS[best - 1]] : hasLevels ? T.levelNames.NONE : '—';

  return (
    <div className="space-y-5">
      {evaluation.needsHumanReview && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        >
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{T.needsReview}</p>
            {evaluation.reviewReasons?.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {evaluation.reviewReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label={T.overallL2}
          value={overallPercent != null ? `${overallPercent}%` : '—'}
          hint={T.overallL2Hint}
          badge={
            <Badge variant={category ? 'success' : 'warning'} size="sm">
              {category ?? T.belowBands}
            </Badge>
          }
        />
        <Stat
          label={T.technicalScore}
          value={technicalPercent != null ? `${technicalPercent}%` : '—'}
          hint={T.technicalScoreHint}
        />
        <Stat
          label={T.coverage}
          value={evaluation.coverage != null ? `${Math.round(evaluation.coverage * 100)}%` : '—'}
          hint={T.coverageHint}
        />
        <Stat
          label={T.confidence}
          value={evaluation.confidence != null ? `${Math.round(evaluation.confidence * 100)}%` : '—'}
          hint={T.confidenceHint}
        />
        <Stat label={T.highestLevel} value={bestLabel} hint={T.domainsAssessed(assessedCount, categories.length)} />
      </div>
      <p className="-mt-2 text-xs text-[var(--textSecondary)]">
        {T.domainsAssessed(assessedCount, categories.length)}
      </p>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text)]">{T.domains}</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {ordered.map((category) => (
              <DomainRow
                key={category.category}
                category={category}
                selected={category.category === selected?.category}
                onSelect={() => setSelectedName(category.category)}
                hasLevels={hasLevels}
              />
            ))}
          </div>
        </div>
        {selected ? (
          <DomainDetail category={selected} rows={rows} hasLevels={hasLevels} />
        ) : (
          <p className="text-sm text-[var(--textSecondary)]">{T.selectDomain}</p>
        )}
      </div>
    </div>
  );
}
