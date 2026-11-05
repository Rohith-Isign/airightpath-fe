import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BackLink } from '@/components/ui/BackLink';
import { Loader2, Video, Send, Mail, Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateTimeInput } from '@/components/ui/DateTimeInput';
import { nowDateTimeLocal, isPast } from '@/utils/datetime.utils';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { InterviewPromptPanel } from '@/components/admin/InterviewPromptPanel';
import { useToast } from '@/components/ui/Toast';
import { jobService } from '@/services/job.service';
import { jobApplicationService } from '@/services/job-application.service';
import { interviewService } from '@/services/interview.service';
import { MESSAGES } from '@/config/messages';
import { INTERVIEW_ASSIGN_STAGES } from '@/utils/interview-assign-stages';
import type { JobPostDTO, JobApplicationDTO } from '@/types/job.types';
import { INTERVIEW_ROUND_LABELS } from '@/types/interview.types';
import type { InterviewRound, InterviewSchedule } from '@/types/interview.types';
import { formatServerDateTime } from '@/utils/format.utils';

const ROUND_OPTIONS = (Object.keys(INTERVIEW_ROUND_LABELS) as InterviewRound[]).map((value) => ({
  value,
  label: INTERVIEW_ROUND_LABELS[value],
}));

/** What the Candidates screen hands over when it sends the admin here to book someone. */
interface SchedulerHandoff {
  jobPrefix?: string;
  emails?: string[];
  round?: InterviewRound;
  // The form as it was left, handed back when the admin returns from another screen (the full prompt editor).
  startTime?: string;
  deadlineTime?: string;
  sendEmail?: boolean;
}

export function InterviewSchedulerPage() {
  const { showToast } = useToast();
  const handoff = (useLocation().state as SchedulerHandoff | null) ?? {};

  const [jobs, setJobs] = useState<JobPostDTO[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState(handoff.jobPrefix ?? '');
  const [candidates, setCandidates] = useState<JobApplicationDTO[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [deadlineTime, setDeadlineTime] = useState(handoff.deadlineTime ?? '');
  /** When the interview opens; the deadline is when it closes. Starts at now. */
  const [startTime, setStartTime] = useState(handoff.startTime ?? nowDateTimeLocal());
  /** Floor for the deadline picker, fixed on mount. */
  const [minDateTime] = useState(nowDateTimeLocal);
  const deadlineInPast = !!deadlineTime && isPast(deadlineTime);
  const endBeforeStart = !!deadlineTime && !!startTime && deadlineTime <= startTime;
  const [sendEmail, setSendEmail] = useState(handoff.sendEmail ?? true);
  /**
   * Which interview to book. L2 first because it is the round that follows the
   * exam; L3 is scheduled after it, for candidates who passed.
   */
  const [round, setRound] = useState<InterviewRound>(handoff.round ?? 'L2_TECHNICAL');
  /**
   * Whether the selected round has a prompt behind it.
   *
   * Reported by the panel below, which resolves it the same way the server
   * does. Booking is still allowed without one — the deadline may be the reason
   * for booking now — but the button says what will happen.
   */
  const [promptConfigured, setPromptConfigured] = useState(true);

  /** Every booking on this job, so a candidate who already has the round shows their existing window. */
  const [schedules, setSchedules] = useState<InterviewSchedule[]>([]);
  const [schedulesFailed, setSchedulesFailed] = useState(false);
  /** Set once the admin edits a time, so loading an existing booking never overwrites what they typed. */
  const timesTouched = useRef(!!handoff.deadlineTime);
  const firstRun = useRef(true);

  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedPrefix) {
      fetchCandidates();
    } else {
      setCandidates([]);
    }
    // Arriving from Candidates, the people picked there are already selected; changing the job clears them.
    setSelectedEmails(
      selectedPrefix && selectedPrefix === handoff.jobPrefix
        ? new Set(handoff.emails ?? [])
        : new Set(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrefix]);

  async function fetchSchedules() {
    if (!selectedPrefix) {
      setSchedules([]);
      return;
    }
    try {
      const res = await interviewService.getResults(selectedPrefix, undefined, { silent: true });
      setSchedules(res.data ?? []);
      setSchedulesFailed(false);
    } catch {
      setSchedules([]);
      setSchedulesFailed(true);
    }
  }

  useEffect(() => {
    // Not on the first run: arriving with a form already filled in (back from the prompt editor) keeps it.
    if (!firstRun.current) timesTouched.current = false;
    firstRun.current = false;
    void fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPrefix, round]);

  /** The live booking of the chosen round for each selected candidate, if they have one. */
  const liveByEmail = new Map<string, InterviewSchedule>();
  for (const sch of schedules) {
    // A booking with no end time recorded is still open: it was never closed, and it is the one to edit.
    const open = sch.attemptStatus !== 'COMPLETED' && !(sch.deadlineTime && isPast(sch.deadlineTime));
    if (!open || (sch.round ?? 'L2_TECHNICAL') !== round) continue;
    const match = [...selectedEmails].find((e) => e.toLowerCase() === (sch.email ?? '').toLowerCase());
    if (match) liveByEmail.set(match, sch);
  }
  /** What this candidate already has for the chosen round, in a line, so the list says it before anything is selected. */
  function bookingLine(email: string): string {
    const mine = schedules
      .filter((x) => (x.round ?? 'L2_TECHNICAL') === round && (x.email ?? '').toLowerCase() === email.toLowerCase())
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    if (!mine) return '';
    const short = round === 'L2_TECHNICAL' ? 'L2' : 'L3';
    if (mine.attemptStatus === 'COMPLETED') return `${short} finished`;
    if (mine.deadlineTime && isPast(mine.deadlineTime)) return `${short} missed (was due ${formatServerDateTime(mine.deadlineTime)})`;
    return mine.attemptStatus === 'IN_PROGRESS'
      ? `${short} in progress`
      : `${short} assigned: ${formatServerDateTime(mine.assignedAt)} → ${mine.deadlineTime ? formatServerDateTime(mine.deadlineTime) : 'no end time set'}`;
  }

  /** Not started yet, so their window can still be moved. */
  const movable = [...liveByEmail.values()].filter((sch) => sch.attemptStatus === 'NOT_ATTEMPTED' && !sch.startedAt);
  /** Already being sat: left alone. */
  const inProgressCount = liveByEmail.size - movable.length;
  const newCount = selectedEmails.size - liveByEmail.size;
  const firstMovableId = movable[0]?.id;

  // Show the existing window to edit, instead of an empty end date, until the admin types their own.
  useEffect(() => {
    const first = movable[0];
    // The existing window fills the fields unless the admin has put their own end time in.
    if (!first || (timesTouched.current && deadlineTime)) return;
    const picker = (stamp?: string) => /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(stamp ?? '')?.slice(1, 3).join('T') ?? '';
    setStartTime(picker(first.assignedAt) || startTime);
    setDeadlineTime(picker(first.deadlineTime));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMovableId]);

  async function fetchJobs() {
    setLoadingJobs(true);
    try {
      const res = await jobService.getAllJobs();
      setJobs(res.data ?? []);
    } catch {
      // Error toast auto-handled by interceptor
    } finally {
      setLoadingJobs(false);
    }
  }

  async function fetchCandidates() {
    if (!selectedPrefix) return;
    setLoadingCandidates(true);
    try {
      const res = await jobApplicationService.getByPrefix(selectedPrefix);
      // Any candidate who is not rejected, with or without an assessment: an interview can be booked at any point,
      // and a candidate who failed a round is at a later stage and still needs it booked again.
      const eligible = (res.data ?? []).filter((c) => INTERVIEW_ASSIGN_STAGES.includes(c.status));
      setCandidates(eligible);
    } catch {
      // Error toast auto-handled by interceptor
    } finally {
      setLoadingCandidates(false);
    }
  }

  function toggleEmail(email: string) {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function toggleAll() {
    if (selectedEmails.size === candidates.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(candidates.map((c) => c.email)));
    }
  }

  async function handleSubmit() {
    if (!selectedPrefix) {
      showToast(MESSAGES.admin.common.selectJob, 'warning');
      return;
    }
    if (selectedEmails.size === 0) {
      showToast(MESSAGES.admin.common.selectCandidate, 'warning');
      return;
    }
    if (deadlineTime && isPast(deadlineTime)) {
      showToast(MESSAGES.admin.candidates.dateTimeInPast, 'warning');
      return;
    }
    if (!deadlineTime) {
      showToast(MESSAGES.admin.interviewScheduler.deadlineTimeRequired, 'warning');
      return;
    }
    if (!startTime || endBeforeStart) {
      showToast('The interview must end after it starts.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Anyone who already holds this round and has not started it has their window moved; anyone being sat is
      // left alone; everyone else is booked now.
      for (const sch of movable) {
        await interviewService.rescheduleInterview(sch.id, {
          assignedAt: startTime,
          deadlineTime,
          notify: sendEmail,
        });
      }
      const toBook = Array.from(selectedEmails).filter((e) => !liveByEmail.has(e));
      if (toBook.length > 0) {
        await interviewService.assignInterviewBulk({
          emails: toBook,
          jobPrefix: selectedPrefix,
          assignedAt: startTime,
          deadlineTime,
          sendEmail,
          round,
        });
      }
      showToast(
        movable.length > 0
          ? `${toBook.length} booked, ${movable.length} moved to the new time${inProgressCount > 0 ? `, ${inProgressCount} already in progress left alone` : ''}.`
          : MESSAGES.admin.interviewScheduler.scheduled(selectedEmails.size),
        'success',
      );
      setSelectedEmails(new Set());
      setDeadlineTime('');
      setStartTime(nowDateTimeLocal());
      setQuestionsFromDate('');
      setQuestionsToDate('');

      // Refresh the lists so the stages and windows shown are current
      if (selectedPrefix) {
        fetchCandidates();
        void fetchSchedules();
      }
    } catch {
      // Error toast auto-handled by interceptor
    } finally {
      setSubmitting(false);
    }
  }

  const jobOptions = [
    { value: '', label: 'Select a job' },
    ...jobs.map((j) => ({ value: j.jobPrefix, label: `${j.jobTitle} (${j.jobPrefix})` })),
  ];

  if (loadingJobs) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={36} className="animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Shown only when another screen sent us here */}
      <BackLink />
      <div>
        <h1 className="text-3xl font-bold text-[var(--text)]">Schedule Interview</h1>
        <p className="text-[var(--textSecondary)] mt-1">
          Assign L2 or L3 AI interviews, or book a further attempt, for any candidate on the job
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video size={20} className="text-[var(--primary)]" />
            <CardTitle>Interview Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Job Selector */}
            <Select
              label="Job"
              options={jobOptions}
              searchable
              searchPlaceholder="Search by job title or prefix..."
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
            />

            {/* Round — what is being booked, so it sits above the candidate list
                rather than next to the submit button. */}
            {selectedPrefix && (
              <div className="max-w-md">
                <Select
                  label="Interview round"
                  options={ROUND_OPTIONS}
                  value={round}
                  onChange={(e) => setRound(e.target.value as InterviewRound)}
                  helperText="Each round is booked separately and graded on its own prompt."
                />
              </div>
            )}

            {/* The prompt this round will interview with. Placed between the
                round and the candidate list because it is a property of the
                round being booked, and because an interview with no prompt
                cannot be started by the people about to be selected. */}
            {selectedPrefix && (
              <InterviewPromptPanel
                jobPrefix={selectedPrefix}
                round={round}
                onConfiguredChange={setPromptConfigured}
                getReturnState={() => ({
                  jobPrefix: selectedPrefix,
                  emails: Array.from(selectedEmails),
                  round,
                  startTime,
                  deadlineTime,
                  sendEmail,
                })}
              />
            )}

            {/* Candidate Selection */}
            {selectedPrefix && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-[var(--text)]">
                    Select Candidates ({selectedEmails.size} selected)
                  </label>
                  {candidates.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-sm text-[var(--primary)] hover:underline"
                    >
                      {selectedEmails.size === candidates.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {loadingCandidates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-[var(--primary)]" />
                  </div>
                ) : candidates.length === 0 ? (
                  <EmptyState
                    title="No eligible candidates"
                    description="No candidates on this job can be booked for an interview yet."
                  />
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
                    {candidates.map((c) => (
                      <label
                        key={c.email}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface1)] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmails.has(c.email)}
                          onChange={() => toggleEmail(c.email)}
                          className="w-4 h-4 rounded border-[var(--inputBorder)] text-[var(--primary)] focus:ring-[var(--inputFocus)]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text)]">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="text-xs text-[var(--textSecondary)] truncate">
                            {c.email} · {c.status.replaceAll('_', ' ').toLowerCase()}
                          </p>
                          {bookingLine(c.email) && (
                            <p className="text-xs text-[var(--primary)]">{bookingLine(c.email)}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Candidates who already hold this round: their current window is what the fields below show and edit. */}
            {schedulesFailed && (
              <p className="text-xs text-[var(--error)]">
                Could not load the interviews already booked for this job, so existing bookings are not shown.
              </p>
            )}
            {liveByEmail.size > 0 && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface1)] p-3 text-sm text-[var(--text)] space-y-1">
                <p className="font-medium">
                  {liveByEmail.size} selected already {liveByEmail.size === 1 ? 'has' : 'have'}{' '}
                  {INTERVIEW_ROUND_LABELS[round]} assigned
                </p>
                {movable.slice(0, 5).map((sch) => (
                  <p key={sch.id} className="text-xs text-[var(--textSecondary)]">
                    {sch.email}: {formatServerDateTime(sch.assignedAt)} →{' '}
                    {sch.deadlineTime ? formatServerDateTime(sch.deadlineTime) : 'no end time set, add one below'}
                  </p>
                ))}
                <p className="text-xs text-[var(--textSecondary)]">
                  Changing the times below moves {movable.length === 1 ? 'that booking' : 'those bookings'}
                  {newCount > 0 ? ` and books the other ${newCount} afresh` : ''}.
                  {inProgressCount > 0 ? ` ${inProgressCount} already in progress will not be changed.` : ''}
                </p>
              </div>
            )}

            {/* Deadline. Native datetime-local, same as the date fields just
                below it and everywhere else in the app. */}
            <DateTimeInput
              label="Start date & time"
              required
              min={minDateTime}
              value={startTime}
              onChange={(value) => {
                timesTouched.current = true;
                setStartTime(value);
              }}
              leftIcon={<Calendar size={16} />}
              helperText="The interview opens for the candidate at this time"
            />
            <DateTimeInput
              label="End date & time (deadline)"
              required
              min={startTime || minDateTime}
              value={deadlineTime}
              onChange={(value) => {
                timesTouched.current = true;
                setDeadlineTime(value);
              }}
              leftIcon={<Calendar size={16} />}
              helperText={deadlineInPast || endBeforeStart ? undefined : 'The interview closes at this time — cannot be in the past'}
              error={
                deadlineInPast
                  ? 'The deadline has already passed'
                  : endBeforeStart
                    ? 'The end must be after the start'
                    : undefined
              }
            />

            {/* Email Notification Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--inputBorder)] text-[var(--primary)] focus:ring-[var(--inputFocus)]"
              />
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-[var(--textSecondary)]" />
                <span className="text-sm text-[var(--text)]">
                  Send email notification to candidates
                </span>
              </div>
            </label>

            {/* Submit */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
              {/* Stated rather than enforced. Booking ahead of writing the
                  prompt is legitimate — the deadline may be the reason to book
                  today — but nobody should discover the gap from a candidate
                  who cannot start. */}
              {selectedPrefix && !promptConfigured && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  Add the prompt above before candidates try to start.
                </p>
              )}
              <Button
                onClick={handleSubmit}
                isLoading={submitting}
                leftIcon={!submitting ? <Send size={16} /> : undefined}
                disabled={!selectedPrefix || selectedEmails.size === 0 || !deadlineTime || !startTime || endBeforeStart}
              >
                {movable.length > 0 ? 'Update Interview' : 'Schedule Interview'}
                {selectedEmails.size > 1 ? ` (${selectedEmails.size})` : ''}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}