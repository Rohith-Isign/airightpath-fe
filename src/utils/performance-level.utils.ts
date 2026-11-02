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
    meaning: 'Exceptional command of the subject; answers were accurate, deep and well reasoned.',
  },
  {
    min: 8,
    label: 'Excellent',
    variant: 'success',
    meaning: 'Strong, dependable knowledge with only minor gaps; exceeds what the role requires.',
  },
  {
    min: 7,
    label: 'Good',
    variant: 'info',
    meaning: 'Solid working knowledge; meets the expectations of the role with some areas to strengthen.',
  },
  {
    min: 6,
    label: 'Satisfactory',
    variant: 'primary',
    meaning: 'Adequate understanding of the fundamentals, but inconsistent depth or application.',
  },
  {
    min: 4,
    label: 'Needs Improvement',
    variant: 'warning',
    meaning: 'Partial understanding; significant gaps for the demands of the role.',
  },
  {
    min: 0,
    label: 'Poor',
    variant: 'error',
    meaning: 'Little evidence of the required knowledge; answers were incorrect, very limited or missing.',
  },
];

/** The band a 0-10 score falls in, or null when there is no score to describe. */
export function performanceLevel(score: number | null | undefined): PerformanceLevel | null {
  if (score == null || Number.isNaN(score)) return null;
  const clamped = Math.min(10, Math.max(0, score));
  return LEVELS.find((level) => clamped >= level.min) ?? LEVELS[LEVELS.length - 1];
}
