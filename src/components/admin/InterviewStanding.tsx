import { STRINGS } from '@/constants/strings';
import { CalendarClock, CheckCircle2, Clock, Loader2, PlayCircle, RotateCcw, TimerOff, Video } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { INTERVIEW_ROUND_LABELS } from '@/types/interview.types';
import type { InterviewRound } from '@/types/interview.types';
import { formatDateTime } from '@/utils/format.utils';
import { INTERVIEW_ROUNDS, roundAction } from '@/utils/interview-standing.utils';
import type { CandidateInterviewStanding, RoundStanding } from '@/utils/interview-standing.utils';

/** How each state reads, and what it is telling the admin to do about it. */
const STATE_DISPLAY: Record<
  RoundStanding['state'],
  { label: string; variant: 'info' | 'warning' | 'success' | 'error' | 'secondary'; icon: React.ReactNode }
> = {
  pending: {
    label: STRINGS.interviewStatus.assigned,
    variant: 'info',
    icon: <CalendarClock size={12} className="flex-shrink-0" />,
  },
  'in-progress': {
    label: STRINGS.interviewStatus.inProgress,
    variant: 'warning',
    icon: <PlayCircle size={12} className="flex-shrink-0" />,
  },
  // Not "missed": nobody has judged the candidate yet, and the only thing this
  // state actually licenses is booking them again.
  expired: {
    label: STRINGS.interviewStatus.notAttended,
    variant: 'error',
    icon: <TimerOff size={12} className="flex-shrink-0" />,
  },
  completed: {
    label: STRINGS.interviewStatus.completed,
    variant: 'success',
    icon: <CheckCircle2 size={12} className="flex-shrink-0" />,
  },
};

/** What the round's own action button says. */
const ACTION_LABEL = { assign: 'Assign', edit: 'Edit', reassign: 'Reassign' } as const;

/** One round of the candidate's journey: where it stands, and the one thing that can be done next. */
function RoundTrack({
  round,
  standing,
  action,
  onAssign,
}: Readonly<{
  round: InterviewRound;
  standing?: RoundStanding;
  action: 'assign' | 'edit' | 'reassign' | null;
  onAssign?: (round: InterviewRound) => void;
}>) {
  const display = standing ? STATE_DISPLAY[standing.state] : null;

  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-[var(--text)]">{INTERVIEW_ROUND_LABELS[round]}</span>

        {/* Attempt count only once it is more than one — "×1" is noise. */}
        {standing && standing.attempts > 1 && (
          <span
            className="text-[10px] font-semibold text-[var(--warning)]"
            title={`Booked ${standing.attempts} times`}
          >
            ×{standing.attempts}
          </span>
        )}

        {standing && display ? (
          <Badge variant={display.variant} size="sm">
            <span className="flex items-center gap-1">
              {display.icon}
              {display.label}
            </span>
          </Badge>
        ) : (
          <span className="text-[11px] text-[var(--textTertiary)]">Not assigned</span>
        )}

        {standing?.state === 'completed' && standing.score !== null && (
          <span className="text-xs font-bold text-[var(--text)]">{standing.score}%</span>
        )}

        {/* The verdict, once there is one. PENDING means the evaluation has not
            landed yet, which is not a verdict and is not shown as one. */}
        {standing?.state === 'completed' && standing.result && standing.result !== 'PENDING' && (
          <Badge variant={standing.result === 'PASSED' ? 'success' : 'error'} size="sm">
            {standing.result}
          </Badge>
        )}
      </div>

      {/* The deadline, while it is still the thing that matters. Once the
          interview is sat, when it was due is history. */}
      {standing && standing.state !== 'completed' && standing.deadlineTime && (
        <p className="flex items-center gap-1 text-[10px] text-[var(--textTertiary)]">
          <Clock size={10} className="flex-shrink-0" />
          {standing.state === 'expired' ? 'Was due' : 'Due'} {formatDateTime(standing.deadlineTime)}
        </p>
      )}

      {action && onAssign && (
        <Button
          size="sm"
          variant={action === 'assign' ? 'primary' : 'outline'}
          leftIcon={action === 'reassign' ? <RotateCcw size={12} /> : <Video size={12} />}
          onClick={() => onAssign(round)}
        >
          {ACTION_LABEL[action]} {round === 'L2_TECHNICAL' ? 'L2' : 'L3'}
        </Button>
      )}
    </div>
  );
}

/**
 * Where a candidate stands in their interviews, in the width of a table cell.
 *
 * L2 and L3 each get their own track — a status, a score and verdict, a deadline and the next action — so that the
 * journey reads as two steps, not one mixed list. L3 stays visible as "Not assigned" until L2 has been passed, and
 * from then on offers its own Assign button, so moving a candidate from L2 to L3 is one click on the row they are
 * already looking at.
 */
export function InterviewStanding({
  standing,
  loading,
  onAssign,
}: Readonly<{
  standing?: CandidateInterviewStanding;
  /** The schedules are still arriving, so absence isn't reported as fact. */
  loading?: boolean;
  /** Books (or re-books) a round for this candidate. */
  onAssign?: (round: InterviewRound) => void;
}>) {
  if (loading && !standing) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--textTertiary)]">
        <Loader2 size={12} className="animate-spin" />
        Loading
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      {INTERVIEW_ROUNDS.map((round) => (
        <RoundTrack
          key={round}
          round={round}
          standing={standing?.rounds.find((r) => r.round === round)}
          action={roundAction(standing, round)}
          onAssign={onAssign}
        />
      ))}
    </div>
  );
}
