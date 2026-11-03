import type { JobApplicationStatus } from '@/types/job.types';
import type { CandidateInterviewStanding } from '@/utils/interview-standing.utils';

/**
 * Where a candidate is in the interview rounds, as a pipeline stage of its own.
 *
 * The stored application status says only "interview scheduled" or "interview completed", which cannot tell L2 from
 * L3. Each round is its own phase here, derived from the interviews themselves:
 *
 * - L2 Sent: L2 booked, not finished (waiting to be sat, or missed)
 * - L2 Done: L2 finished, nothing booked after it, the point at which the admin moves the candidate to L3
 * - L3 Sent / L3 Done: the same for L3
 *
 * They are typed as application statuses so they can sit among the stage tabs, but they are never stored.
 */
export const INTERVIEW_PHASES = ['L2_SENT', 'L2_DONE', 'L3_SENT', 'L3_DONE'] as JobApplicationStatus[];

const asStage = (value: string) => value as JobApplicationStatus;

/** The stage tab a candidate belongs on, given their stored status and their interviews. */
export function stageOf(
  status: string | undefined,
  standing: CandidateInterviewStanding | undefined,
): JobApplicationStatus {
  const current = status ?? '';
  if (current !== 'INTERVIEW_SCHEDULED' && current !== 'INTERVIEW_COMPLETED') return asStage(current);

  const l2 = standing?.rounds.find((r) => r.round === 'L2_TECHNICAL');
  const l3 = standing?.rounds.find((r) => r.round === 'L3_BEHAVIORAL');
  if (l3) return asStage(l3.state === 'completed' ? 'L3_DONE' : 'L3_SENT');
  if (l2) return asStage(l2.state === 'completed' ? 'L2_DONE' : 'L2_SENT');
  // No interview rows to go on (still loading, or an older record): follow the stored status.
  return asStage(current === 'INTERVIEW_COMPLETED' ? 'L2_DONE' : 'L2_SENT');
}
