import type { JobApplicationStatus } from '@/types/job.types';

/**
 * Stages from which an interview can be booked (or booked again), for the Candidates screen and the Schedule
 * Interview screen alike.
 *
 * Not before the exam has been sat: until then there is no paper to judge a candidate on. From then on the stage
 * does not matter, because a re-attempt is needed exactly where a candidate's stage has already moved past the round
 * being re-booked (a candidate who failed L2 is at Interview Completed). What matters is whether the round is still
 * open for them, and the server refuses a round that is.
 */
export const INTERVIEW_ASSIGN_STAGES: JobApplicationStatus[] = [
  'EXAM_COMPLETED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'SELECTED',
];
