import type { JobApplicationStatus } from '@/types/job.types';
import { INTERVIEW_PHASES } from '@/utils/interview-phase';

/**
 * Stages from which an interview can be booked (or booked again), for the Candidates screen and the Schedule
 * Interview screen alike.
 *
 * Every stage except Rejected. An admin can book L2 or L3 at any point, with or without an assessment: some
 * candidates are interviewed without sitting the exam, and a candidate whose stage has moved past a round still needs
 * that round booked again. What matters is whether the round is still open for the candidate, and the server refuses
 * a round that is.
 */
export const INTERVIEW_ASSIGN_STAGES: JobApplicationStatus[] = [
  'APPLIED',
  'SHORTLISTED',
  'ACKNOWLEDGED',
  'ACKNOWLEDGED_BACK' as JobApplicationStatus,
  'RECONFIRMED',
  'EXAM_SENT',
  'EXAM_COMPLETED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  ...INTERVIEW_PHASES,
  'SELECTED',
];
