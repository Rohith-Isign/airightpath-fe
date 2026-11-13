import { useMemo, useState } from 'react';
import { AlertTriangle, Check, CircleDashed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { STRINGS } from '@/constants/strings';
import { PerformanceRating } from '@/components/admin/result/PerformanceRating';
import { AreaQuestions } from '@/components/admin/result/AreaQuestions';
import { RadialScore } from '@/components/admin/result/ResultPrimitives';
import { l2Category, toPercent } from '@/utils/l2-category.utils';
import type { QuestionRow } from '@/utils/interview-questions.utils';
import type { TechnicalLevel, VoiceCategoryScore, VoiceEvaluationResult } from '@/types/interview.types';

const T = STRINGS.technicalReport;

type Level = Exclude<TechnicalLevel, 'NONE'>;
const LEVELS: Level[] = ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

/** 0 for none or unknown, 1..4 for Basic..Expert. */
function levelRank(level: TechnicalLevel | null | undefined): number {
  const index = level ? LEVELS.indexOf(level as Level) : -1;
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

/** High / Medium / Low, in words, from the grader's 0-1 confidence. */
function confidenceLabel(confidence: number | null | undefined): string {
  if (confidence == null) return '—';
  if (confidence >= 0.75) return T.confidenceHigh;
  if (confidence >= 0.5) return T.confidenceMedium;
  return T.confidenceLow;
}

interface LevelStat {
  /** Questions asked at this level. */
  count: number;
  answered: number;
  /** Average rating of the answers, as a percentage, or null when none was rated. */
  percent: number | null;
}

/** For each level, what the given questions asked at it and how the answers to them were rated. */
function levelStats(rows: QuestionRow[]): Record<Level, LevelStat> {
  const stats = {} as Record<Level, LevelStat>;
  LEVELS.forEach((level) => {
    const atLevel = rows.filter((row) => row.level === level);
    const scored = atLevel.map((row) => row.score).filter((score): score is number => score != null);
    stats[level] = {
      count: atLevel.length,
      answered: atLevel.filter((row) => row.answered).length,
      percent: scored.length ? Math.round((scored.reduce((sum, s) => sum + s, 0) / scored.length) * 10) : null,
    };
  });
  return stats;
}

function toneFor(percent: number | null): string {
  if (percent == null) return 'text-[var(--textTertiary)]';
  if (percent >= 70) return 'text-[var(--success)]';
  if (percent >= 50) return 'text-[var(--warning)]';
  return 'text-[var(--error)]';
}

function barColor(percent: number | null): string {
  if (percent == null) return 'var(--border)';
  if (percent >= 70) return 'var(--success)';
  if (percent >= 50) return 'var(--warning)';
  return 'var(--error)';
}

/** Four steps, filled up to the level reached. Reads at a glance in a list. */
function LevelSteps({ level }: Readonly<{ level: TechnicalLevel | null | undefined }>) {
  const reached = levelRank(level);
  const label = level && level !== 'NONE' ? T.levelNames[level] : T.levelNames.NONE;
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${T.highestLevel}: ${label}`}>
      {LEVELS.map((name, index) => (
        <span
          key={name}
          title={`${T.levelNames[name]}: ${index < reached ? T.reached : T.notReached}`}
          className={`h-1.5 flex-1 rounded-full ${index < reached ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}`}
        />
      ))}
    </div>
  );
}

function SummaryLine({ label, value, hint }: Readonly<{ label: string; value: React.ReactNode; hint?: string }>) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm" title={hint}>
      <span className="flex items-center gap-2 text-[var(--textSecondary)]">
        <Check size={14} className="flex-shrink-0 text-[var(--success)]" />
        {label}
      </span>
      <span className="font-semibold text-[var(--text)]">{value}</span>
    </li>
  );
}

/** The four overall level tiles: how the answers rated at each depth the interview reached. */
function LevelAchievement({ stats, hasLevels }: Readonly<{ stats: Record<Level, LevelStat>; hasLevels: boolean }>) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-[var(--text)]">{T.levelAchievement}</h4>
      {hasLevels ? (
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map((level) => {
            const stat = stats[level];
            return (
              <div
                key={level}
                className={`rounded-xl border p-3 text-center ${
                  stat.count ? 'border-[var(--border)] bg-[var(--cardBg,var(--surface1))]' : 'border-dashed border-[var(--border)]'
                }`}
              >
                <p className="text-xs font-semibold text-[var(--textSecondary)]">{T.levelNames[level]}</p>
                <p className={`mt-1 text-xl font-bold ${toneFor(stat.percent)}`}>
                  {stat.percent != null ? `${stat.percent}%` : '—'}
                </p>
                <p className="text-[11px] text-[var(--textTertiary)]">
                  {stat.count ? T.questionsAtLevel(stat.count) : T.noneAsked}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-3 text-xs text-[var(--textTertiary)]">
          {T.levelNotRecorded}
        </p>
      )}
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
  const percent = toPercent(category.score);
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
          <span className={`flex-shrink-0 text-sm font-bold ${toneFor(percent)}`}>{percent}%</span>
        ) : (
          <Badge variant="default" size="sm">
            {T.notAssessed}
          </Badge>
        )}
      </div>
      {assessed && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${percent ?? 0}%`, background: barColor(percent) }}
            />
          </div>
          {hasLevels && category.highestLevel && category.highestLevel !== 'NONE' && (
            <Badge variant="primary" size="sm">
              {T.levelNames[category.highestLevel]}
            </Badge>
          )}
        </div>
      )}
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
  const percent = toPercent(category.score) ?? 0;

  // The questions this domain's score rests on, so each level shows only what was asked in this domain.
  const domainRows = useMemo(
    () =>
      (category.questionNumbers ?? [])
        .map((number) => rows.find((row) => row.number === number))
        .filter((row): row is QuestionRow => row !== undefined),
    [category.questionNumbers, rows],
  );
  const stats = useMemo(() => levelStats(domainRows), [domainRows]);
  const hasRowLevels = domainRows.some((row) => row.level != null);
  const highest = reached > 0 ? T.levelNames[LEVELS[reached - 1]] : null;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-semibold text-[var(--text)]">{category.category}</h4>
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
        {assessed && highest && (
          <Badge variant="success" size="md">
            {T.highestDemonstrated}: {highest}
          </Badge>
        )}
      </div>

      {assessed ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="flex justify-center">
              <RadialScore score={percent} size={120} stroke={10} label={T.skillScore} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--text)]">{T.levelPerformance}</p>
              {LEVELS.map((level, index) => {
                const stat = stats[level];
                // Without per-question levels (an older interview) fall back to what is known: reached or not.
                const shown = hasRowLevels ? stat.percent : index < reached ? percent : null;
                return (
                  <div key={level} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm">
                    <span className="text-[var(--textSecondary)]">{T.levelNames[level]}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${shown ?? 0}%`, background: barColor(shown) }}
                      />
                    </div>
                    <span className={`text-right font-semibold ${toneFor(shown)}`}>
                      {shown != null ? `${shown}%` : '—'}
                    </span>
                  </div>
                );
              })}
              {!hasLevels && <p className="text-xs text-[var(--textTertiary)]">{T.levelNotRecorded}</p>}
            </div>
          </div>

          {hasLevels && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--textSecondary)]">{T.levels}</p>
              <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {LEVELS.map((level, index) => {
                  const filled = index < reached;
                  const stat = stats[level];
                  return (
                    <li
                      key={level}
                      className={`rounded-xl border p-3 ${
                        filled
                          ? 'border-[var(--primary)] bg-[var(--primaryMuted,var(--surface1))]'
                          : 'border-dashed border-[var(--border)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
                        {filled ? (
                          <Check size={14} className="flex-shrink-0 text-[var(--primary)]" />
                        ) : (
                          <CircleDashed size={14} className="flex-shrink-0 text-[var(--textTertiary)]" />
                        )}
                        {T.levelNames[level]}
                      </div>
                      <p className={`mt-1 text-xl font-bold ${toneFor(hasRowLevels ? stat.percent : null)}`}>
                        {hasRowLevels && stat.percent != null ? `${stat.percent}%` : '—'}
                      </p>
                      <p className="text-[11px] text-[var(--textTertiary)]">
                        {hasRowLevels
                          ? stat.count
                            ? T.questionsAtLevel(stat.count)
                            : T.noneAsked
                          : filled
                            ? T.reached
                            : T.notReached}
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-[var(--textSecondary)]">
                        {T.levelDescriptions[level]}
                      </p>
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-[var(--textTertiary)]">{T.levelsNote}</p>
            </div>
          )}

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

type Tab = 'overall' | 'skills';

/**
 * The L2 result, laid out as the technical assessment report: the verdict first (score ring, summary, level-wise
 * achievement), then the skills one at a time.
 *
 * <p>A reviewer comes here to answer "should this person go forward, and how sure are we", so that is the top of the
 * page. Performance, coverage and confidence stay separate numbers on purpose; a high score over thin coverage must
 * not read as a strong candidate. Level percentages are the interviewer's ratings of the answers given at each
 * depth, so they show where the candidate stopped answering well.</p>
 *
 * <p>An area no question reached is shown as not assessed, never as zero, and a level the candidate did not show is
 * "not shown", never "failed".</p>
 */
export function TechnicalDomainReport({
  evaluation,
  rows,
}: Readonly<{ evaluation: VoiceEvaluationResult; rows: QuestionRow[] }>) {
  const categories = evaluation.categoryScores;
  const [tab, setTab] = useState<Tab>('overall');

  // Assessed first, in the order the grader gave; areas never reached sink to the bottom of the list.
  const ordered = useMemo(
    () => [...categories].sort((a, b) => Number(isAssessed(b)) - Number(isAssessed(a))),
    [categories],
  );
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = ordered.find((c) => c.category === selectedName) ?? ordered[0];

  const assessedCount = categories.filter(isAssessed).length;
  const hasLevels = categories.some((c) => c.highestLevel != null) || rows.some((row) => row.level != null);
  const best = categories.reduce((top, c) => Math.max(top, levelRank(c.highestLevel)), 0);
  const bestLabel = best > 0 ? T.levelNames[LEVELS[best - 1]] : hasLevels ? T.levelNames.NONE : '—';
  const overallStats = useMemo(() => levelStats(rows), [rows]);

  const overallPercent = toPercent(evaluation.overallScore);
  // Falls back to the overall when the grader gave no assessed-only figure (older results): everything was
  // treated as tested there, so the two are the same number.
  const technicalPercent = toPercent(evaluation.assessedScore ?? evaluation.overallScore);
  const category = l2Category(overallPercent);

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

      {/* The verdict: score ring, what it rests on, and how the levels went. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface1)] p-4"
          title={T.overallL2Hint}
        >
          <RadialScore score={overallPercent ?? 0} size={124} stroke={11} label={T.overallShort} />
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-[var(--textSecondary)]">{T.overallL2}</p>
            <Badge variant={category ? 'success' : 'warning'} size="md">
              {category ?? T.belowBands}
            </Badge>
            <p className="text-xs text-[var(--textSecondary)]" title={T.technicalScoreHint}>
              {T.technicalScore}:{' '}
              <span className="font-semibold text-[var(--text)]">
                {technicalPercent != null ? `${technicalPercent}%` : '—'}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface1)] p-4">
          <h4 className="mb-3 text-sm font-semibold text-[var(--text)]">{T.assessmentSummary}</h4>
          <ul className="space-y-2">
            <SummaryLine label={T.highestLevel} value={bestLabel} />
            <SummaryLine label={T.skillsCovered} value={`${assessedCount} / ${categories.length}`} />
            <SummaryLine
              label={T.coverage}
              value={evaluation.coverage != null ? `${Math.round(evaluation.coverage * 100)}%` : '—'}
              hint={T.coverageHint}
            />
            <SummaryLine label={T.confidence} value={confidenceLabel(evaluation.confidence)} hint={T.confidenceHint} />
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface1)] p-4">
          <LevelAchievement stats={overallStats} hasLevels={hasLevels} />
        </div>
      </div>

      <div role="tablist" aria-label={T.title} className="flex gap-1 border-b border-[var(--border)]">
        {(['overall', 'skills'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
              tab === id
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--textSecondary)] hover:text-[var(--text)]'
            }`}
          >
            {id === 'overall' ? T.tabOverall : T.tabSkills(categories.length)}
          </button>
        ))}
      </div>

      {tab === 'overall' ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text)]">{T.domains}</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((c) => (
              <DomainRow
                key={c.category}
                category={c}
                selected={false}
                onSelect={() => {
                  setSelectedName(c.category);
                  setTab('skills');
                }}
                hasLevels={hasLevels}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-[var(--text)]">{T.assessedSkills(assessedCount)}</h4>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {ordered.map((c) => (
                <DomainRow
                  key={c.category}
                  category={c}
                  selected={c.category === selected?.category}
                  onSelect={() => setSelectedName(c.category)}
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
      )}
    </div>
  );
}
