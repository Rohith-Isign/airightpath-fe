/**
 * The four L2 candidate categories, and the two percentages they are read from.
 *
 * <p>The four labels come from the L2 specification; their cut-offs were left open there, so they are set here, in
 * one place, as a product setting to be reviewed and not as a rule of the model. Changing a band means changing
 * {@link L2_CATEGORY_BANDS} and nothing else. They apply to the OVERALL L2 score, not to a single domain.</p>
 *
 * <p>The two scores differ on purpose:</p>
 * <ul>
 *   <li><b>Overall L2 score</b>: the weighted score over every scoring area. An area no question reached adds
 *       nothing, so a candidate tested on half the role scores lower overall than on what they were tested on.</li>
 *   <li><b>Technical score</b>: how well the candidate did on the areas that were actually tested. Where every area
 *       was tested the two are equal.</li>
 * </ul>
 * Read together they separate "weak" from "not fully tested".
 */
export type L2Category = 'Awesome' | 'Excellent' | 'Very Good' | 'Good';

/** Minimum overall L2 score, in percent, for each category. Highest first. */
export const L2_CATEGORY_BANDS: readonly { min: number; label: L2Category }[] = [
  { min: 90, label: 'Awesome' },
  { min: 80, label: 'Excellent' },
  { min: 70, label: 'Very Good' },
  { min: 60, label: 'Good' },
];

/** The category an overall L2 percentage earns, or null below the lowest band ("not yet Good"). */
export function l2Category(overallPercent: number | null | undefined): L2Category | null {
  if (overallPercent == null || Number.isNaN(overallPercent)) return null;
  return L2_CATEGORY_BANDS.find((band) => overallPercent >= band.min)?.label ?? null;
}

/** A 0-10 grader score as a whole percentage. */
export function toPercent(score: number | null | undefined): number | null {
  if (score == null || Number.isNaN(score)) return null;
  return Math.round(Math.min(10, Math.max(0, score)) * 10);
}
