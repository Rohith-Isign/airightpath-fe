import { STRINGS } from '@/constants/strings';
import { isPast } from '@/utils/datetime.utils';
import type {
  InterviewResult,
  InterviewRound,
  InterviewSchedule,
} from '@/types/interview.types';

export const INTERVIEW_ROUNDS: InterviewRound[] = ['L2_TECHNICAL', 'L3_BEHAVIORAL'];

/**
 * Where one round stands for one candidate.
 *
 * `pending` and `expired` are kept apart deliberately. Both mean "not sat", but
 * only one of them is still the candidate's to sit — and that difference is the
 * whole of the re-booking rule, so a column that collapsed them would show an
 * admin exactly the thing they cannot act on.
 */
export type RoundState = 'pending' | 'in-progress' | 'expired' | 'completed';

export interface RoundStanding {
  round: InterviewRound;
  /** How many times this round has been booked. Every booking is kept. */
  attempts: number;
  state: RoundState;
  /** Deadline of the attempt being reported — the most recent one. */
  deadlineTime?: string;
  /** Only meaningful once `state` is `completed`. */
  result?: InterviewResult;
  /** Overall score from the evaluation, when one has been produced. */
  score: number | null;
  /** True while this round is still live, so it cannot be booked again. */
  outstanding: boolean;
}

export interface CandidateInterviewStanding {
  /** Only rounds this candidate has actually been booked for. */
  rounds: RoundStanding[];
  /** True when any round is still live. Drives "Assign" vs "Reassign". */
  hasOutstanding: boolean;
}

/** Newest first, by assignment time, falling back to id. */
function newestFirst(a: InterviewSchedule, b: InterviewSchedule): number {
  const at = new Date(a.assignedAt ?? '').getTime();
  const bt = new Date(b.assignedAt ?? '').getTime();
  if (!Number.isNaN(at) && !Number.isNaN(bt) && at !== bt) return bt - at;
  return (b.id ?? 0) - (a.id ?? 0);
}

/**
 * What state one schedule is in.
 *
 * Handed in beats out of time: a candidate who submitted a minute before the
 * deadline and one who submitted a minute after both sat the interview, and
 * reporting the second as "expired" would lose a transcript that exists.
 */
function stateOf(schedule: InterviewSchedule): RoundState {
  if (schedule.attemptStatus === 'COMPLETED') return 'completed';
  if (schedule.deadlineTime && isPast(schedule.deadlineTime)) return 'expired';
  return schedule.attemptStatus === 'IN_PROGRESS' ? 'in-progress' : 'pending';
}

/**
 * True once the booked slot has closed and the candidate never began: the interview was missed.
 *
 * Worked out from the deadline each time it is asked, not stored, so it flips the moment the slot ends without a
 * background job having to run first.
 */
export function isNotAttended(schedule: Pick<InterviewSchedule, 'attemptStatus' | 'deadlineTime'>): boolean {
  return (
    schedule.attemptStatus === 'NOT_ATTEMPTED' &&
    !!schedule.deadlineTime &&
    isPast(schedule.deadlineTime)
  );
}

/**
 * Whether an interview was graded and found to have nothing to grade.
 *
 * <p>A finished interview the candidate never answered is deliberately left
 * PENDING — the grader refuses to invent a score, and whether silence means a
 * no-show, a broken microphone or a withdrawal is not something it can know.
 * But "PENDING" on a completed row reads as "the scoring has not run yet",
 * which is the one thing it does not mean. The evaluation is there; it says
 * there was nothing to assess.</p>
 */
export function isNotAssessable(interview: InterviewSchedule): boolean {
  return (
    interview.attemptStatus === 'COMPLETED' &&
    interview.interviewResult === 'PENDING' &&
    !!interview.evaluation &&
    !interview.evaluation.recommendation
  );
}

/** The status an admin reads for one interview: the stored one, except that a missed slot says "Not Attended". */
export function attemptStatusLabel(
  schedule: Pick<InterviewSchedule, 'attemptStatus' | 'deadlineTime'>,
): string {
  return isNotAttended(schedule) ? STRINGS.interviewStatus.notAttendedBadge : schedule.attemptStatus.replace(/_/g, ' ');
}

/**
 * One candidate's interview standing, built from their schedules for a job.
 *
 * The pipeline stage says "Interview" or "Interview Done" and stops there. It
 * cannot say which round, whether they have started it, whether the deadline
 * has gone by, or how it went — which is everything an admin is deciding on
 * when they look at this screen, and the reason it was impossible to tell an
 * assigned candidate from a completed one without opening Interview Results.
 */
export function buildInterviewStanding(
  schedules: InterviewSchedule[],
): CandidateInterviewStanding {
  const rounds: RoundStanding[] = [];

  for (const round of INTERVIEW_ROUNDS) {
    const mine = schedules
      .filter((s) => (s.round ?? 'L2_TECHNICAL') === round)
      .sort(newestFirst);
    if (mine.length === 0) continue;

    // The newest booking is the one in play; older ones are history and stay
    // readable in Interview Results.
    const latest = mine[0];
    const state = stateOf(latest);
    rounds.push({
      round,
      attempts: mine.length,
      state,
      deadlineTime: latest.deadlineTime,
      result: latest.interviewResult,
      score: latest.evaluation?.overallScore ?? null,
      outstanding: state === 'pending' || state === 'in-progress',
    });
  }

  return { rounds, hasOutstanding: rounds.some((r) => r.outstanding) };
}

/** Every candidate's standing for a job, keyed by lowercased email. */
export function buildInterviewStandings(
  schedules: InterviewSchedule[],
): Map<string, CandidateInterviewStanding> {
  const byEmail = new Map<string, InterviewSchedule[]>();
  for (const schedule of schedules) {
    const key = (schedule.email ?? '').toLowerCase();
    if (!key) continue;
    const bucket = byEmail.get(key);
    if (bucket) bucket.push(schedule);
    else byEmail.set(key, [schedule]);
  }

  const standings = new Map<string, CandidateInterviewStanding>();
  for (const [email, mine] of byEmail) {
    standings.set(email, buildInterviewStanding(mine));
  }
  return standings;
}

/**
 * How an interview's result is shown: PASSED or FAILED once there is a verdict, and "INCOMPLETE" for a finished
 * interview that has none. PENDING on a finished interview used to read as "still waiting", when what it means is that
 * the grading found too little evidence to call it (or never ran); the hint says which.
 */
export function resultDisplay(
  schedule: Pick<InterviewSchedule, 'attemptStatus' | 'interviewResult' | 'evaluation'>,
): { label: string; hint?: string } {
  if (schedule.attemptStatus === 'COMPLETED' && schedule.interviewResult === 'PENDING') {
    const evaluated = !!schedule.evaluation;
    return {
      label: STRINGS.scoreBreakdown.noVerdict,
      hint: evaluated ? STRINGS.scoreBreakdown.noVerdictInsufficient : STRINGS.scoreBreakdown.noVerdictNotGraded,
    };
  }
  return { label: schedule.interviewResult };
}

/** What an admin can do about one round for one candidate, from where that round stands. */
export type RoundAction = 'assign' | 'edit' | 'reassign' | null;

/**
 * The next step offered for a round, derived from the candidate's standing.
 *
 * L2 is the first round: booked when nothing has been, booked again when the last attempt was missed or not passed,
 * and nothing while an attempt is live or already passed.
 *
 * L3 follows L2 and is only offered once L2 has been passed: that is the move the screen exists to make, so it is
 * put in front of the admin instead of sitting behind "Reassign". Once booked, the same rule as L2 applies.
 */
export function roundAction(
  standing: CandidateInterviewStanding | undefined,
  round: InterviewRound,
): RoundAction {
  const find = (r: InterviewRound) => standing?.rounds.find((x) => x.round === r);
  const own = find(round);

  if (round === 'L3_BEHAVIORAL') {
    const l2 = find('L2_TECHNICAL');
    const l2Passed = l2?.state === 'completed' && l2.result === 'PASSED';
    if (!own) return l2Passed ? 'assign' : null;
  } else if (!own) {
    return 'assign';
  }

  // Booked and not yet started: nothing to book again, but the times and prompt can still be changed.
  if (own!.outstanding) return own!.state === 'pending' ? 'edit' : null;
  const passed = own!.state === 'completed' && own!.result === 'PASSED';
  // Finished and passed, or finished and still being judged: nothing to redo.
  if (passed || (own!.state === 'completed' && own!.result === 'PENDING')) return null;
  return 'reassign';
}
