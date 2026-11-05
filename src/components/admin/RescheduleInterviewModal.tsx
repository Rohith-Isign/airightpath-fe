import { useState } from 'react';
import { CalendarClock, Mail } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DateTimeInput } from '@/components/ui/DateTimeInput';
import { useToast } from '@/components/ui/Toast';
import { interviewService } from '@/services/interview.service';
import { nowDateTimeLocal, isPast } from '@/utils/datetime.utils';
import { INTERVIEW_ROUND_LABELS } from '@/types/interview.types';
import type { InterviewSchedule } from '@/types/interview.types';

/**
 * Moves the window of an interview the candidate has not started.
 *
 * Only a booking that is still untouched can move: once it has been started, the window it ran under is part of the
 * record. The candidate is emailed the new window, since they were told the old one.
 */
interface RescheduleInterviewModalProps {
  interview: InterviewSchedule;
  onClose: () => void;
  /** Called after a successful save, so the caller can re-read the list. */
  onSaved: () => void;
}

/** A stored timestamp as the picker's `YYYY-MM-DDTHH:mm`, or '' if unusable. */
function toPickerValue(stamp?: string | null): string {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(stamp ?? '');
  return match ? `${match[1]}T${match[2]}` : '';
}

export function RescheduleInterviewModal({
  interview,
  onClose,
  onSaved,
}: Readonly<RescheduleInterviewModalProps>) {
  const { showToast } = useToast();
  const [start, setStart] = useState(toPickerValue(interview.assignedAt));
  const [end, setEnd] = useState(toPickerValue(interview.deadlineTime));
  const [saving, setSaving] = useState(false);

  const roundLabel = INTERVIEW_ROUND_LABELS[interview.round] ?? 'Interview';

  let problem: string | null = null;
  if (!start || !end) {
    problem = 'Both the start and end are needed.';
  } else if (start >= end) {
    problem = 'The interview has to start before it ends.';
  } else if (isPast(end)) {
    problem = 'That end time has already passed, so the candidate could never sit it.';
  }

  async function handleSave() {
    if (problem) {
      showToast(problem, 'warning');
      return;
    }
    setSaving(true);
    try {
      await interviewService.rescheduleInterview(interview.id, { assignedAt: start, deadlineTime: end });
      showToast(`${roundLabel} window updated — the candidate has been emailed.`, 'success');
      onSaved();
      onClose();
    } catch {
      // Error toast auto-handled by the interceptor
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Edit the ${roundLabel} interview time`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button leftIcon={<CalendarClock size={16} />} isLoading={saving} disabled={!!problem} onClick={handleSave}>
            Save and notify
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--textSecondary)]">
          {interview.email} has not started this interview, so its window can still change.
        </p>
        <DateTimeInput label="Starts" value={start} onChange={setStart} min={nowDateTimeLocal()} />
        <DateTimeInput label="Ends" value={end} onChange={setEnd} min={start || nowDateTimeLocal()} />
        {problem && <p className="text-sm text-[var(--error)]">{problem}</p>}
        <p className="flex items-start gap-2 text-xs text-[var(--textTertiary)]">
          <Mail size={14} className="mt-0.5 flex-shrink-0" />
          Saving emails the candidate the new window.
        </p>
      </div>
    </Modal>
  );
}
