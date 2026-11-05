import { useState, useEffect, useCallback } from 'react';
import { Loader2, Video, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { interviewService } from '@/services/interview.service';
import { formatServerDateTime } from '@/utils/format.utils';
import { INTERVIEW_ROUND_LABELS } from '@/types/interview.types';
import type { InterviewSchedule } from '@/types/interview.types';
import { RescheduleInterviewModal } from './RescheduleInterviewModal';

/**
 * The interview rounds booked for this candidate and job, with their windows.
 *
 * A booking the candidate has not started can have its start and end changed here; one that has been started keeps
 * the window it ran under.
 */
interface CandidateInterviewSchedulesProps {
  email: string;
  jobPrefix: string;
}

export function CandidateInterviewSchedules({
  email,
  jobPrefix,
}: Readonly<CandidateInterviewSchedulesProps>) {
  const [interviews, setInterviews] = useState<InterviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InterviewSchedule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interviewService.getResults(jobPrefix, undefined, { silent: true });
      const mine = (res.data ?? []).filter((i) => i.email?.toLowerCase() === email.toLowerCase());
      // Latest booking first.
      setInterviews(mine.sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
    } catch {
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, [email, jobPrefix]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <Loader2 size={18} className="animate-spin text-[var(--primary)]" />;
  }
  if (interviews.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <Video size={16} /> Interview rounds
      </h4>
      {interviews.map((i) => {
        const notStarted = i.attemptStatus === 'NOT_ATTEMPTED' && !i.startedAt;
        return (
          <div
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text)]">
                {INTERVIEW_ROUND_LABELS[i.round] ?? 'Interview'}{' '}
                <Badge variant={notStarted ? 'warning' : 'success'} size="sm">
                  {notStarted ? 'Not started' : i.attemptStatus.replaceAll('_', ' ').toLowerCase()}
                </Badge>
              </p>
              <p className="text-xs text-[var(--textSecondary)]">
                {formatServerDateTime(i.assignedAt)} → {formatServerDateTime(i.deadlineTime)}
              </p>
            </div>
            {notStarted && (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<CalendarClock size={14} />}
                onClick={() => setEditing(i)}
              >
                Edit time
              </Button>
            )}
          </div>
        );
      })}
      {editing && (
        <RescheduleInterviewModal interview={editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}
