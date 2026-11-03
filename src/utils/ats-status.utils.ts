import type { JobApplicationDTO } from '@/types/job.types';

type AtsRow = Pick<JobApplicationDTO, 'status' | 'shortlistStatus' | 'matchPercent'>;

/**
 * Whether ATS screening shortlisted this candidate.
 *
 * Read from the screening outcome (`shortlistStatus`), not the pipeline stage: a candidate who was shortlisted and has
 * since moved on (acknowledged, exam sent, interview scheduled) is no longer at stage SHORTLISTED, but was still
 * shortlisted. Counting by stage made the Shortlisted card and tab say 0 beside a row labelled "Shortlisted".
 * Falls back to the stage for a row with no screening outcome.
 */
export function isAtsShortlisted(candidate: AtsRow): boolean {
  if (candidate.shortlistStatus) return !/not/i.test(candidate.shortlistStatus);
  return candidate.status === 'SHORTLISTED';
}

/** Whether ATS screening turned this candidate down. */
export function isAtsRejected(candidate: AtsRow): boolean {
  if (candidate.shortlistStatus) return /not/i.test(candidate.shortlistStatus);
  return candidate.status === 'REJECTED';
}

/**
 * The ATS score to show, or null when there is no believable one.
 *
 * Screening never shortlists a score of 0, so a shortlisted candidate carrying 0 has a stale or missing score (an
 * older run, or a manual shortlist), not a real result. Showing "0.0%" beside "Shortlisted" read as a broken score.
 */
export function usableAtsScore(candidate: AtsRow): number | null {
  const score = candidate.matchPercent;
  if (score == null) return null;
  if (score === 0 && isAtsShortlisted(candidate)) return null;
  return score;
}
