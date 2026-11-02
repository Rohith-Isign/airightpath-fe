import { STRINGS } from '@/constants/strings';

/**
 * A score in words, so a reviewer comparing candidates does not have to decide for themselves what 6.4 out of 10
 * means. The bands are fixed here rather than left to the grader, so the same score reads the same on every
 * candidate and in every export.
 */
export interface PerformanceLevel {
  label: string;
  variant: 'success' | 'info' | 'primary' | 'warning' | 'error';
  /** What the band means, in the reviewer's terms. */
  meaning: string;
}

/** Interview scores are 0-10. Highest band first. */
const LEVELS: readonly (PerformanceLevel & { min: number })[] = [
  {
    min: 9,
    label: 'Outstanding',
    variant: 'success',
    meaning: STRINGS.performance.outstanding,
  },
  {
    min: 8,
    label: 'Excellent',
    variant: 'success',
    meaning: STRINGS.performance.excellent,
  },
  {
    min: 7,
    label: 'Good',
    variant: 'info',
    meaning: STRINGS.performance.good,
  },
  {
    min: 6,
    label: 'Satisfactory',
    variant: 'primary',
    meaning: STRINGS.performance.satisfactory,
  },
  {
    min: 4,
    label: 'Needs Improvement',
    variant: 'warning',
    meaning: STRINGS.performance.needsImprovement,
  },
  {
    min: 0,
    label: 'Poor',
    variant: 'error',
    meaning: STRINGS.performance.poor,
  },
];

/** The band a 0-10 score falls in, or null when there is no score to describe. */
export function performanceLevel(score: number | null | undefined): PerformanceLevel | null {
  if (score == null || Number.isNaN(score)) return null;
  const clamped = Math.min(10, Math.max(0, score));
  return LEVELS.find((level) => clamped >= level.min) ?? LEVELS[LEVELS.length - 1];
}
