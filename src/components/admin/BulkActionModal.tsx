import { useState, type ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { DateTimeInput } from "@/components/ui/DateTimeInput";
import {
  BUSINESS_TIMEZONE,
  formatScheduleForEmail,
  formatScheduleWithZone,
  isPast,
} from "@/utils/datetime.utils";

interface BulkActionModalProps {
  title: string;
  hasDateTime: boolean;
  dateTimeRequired: boolean;
  recipientCount: number;
  sending: boolean;
  dateTime: string;
  onDateTimeChange: (value: string) => void;
  /**
   * When given, the modal asks for a window: this is when it opens, and `dateTime` becomes when it closes.
   * Booking an interview needs both; the mail actions still take one time.
   */
  startDateTime?: string;
  onStartDateTimeChange?: (value: string) => void;
  /** Earliest selectable moment (`YYYY-MM-DDTHH:mm`) — normally "now". */
  minDateTime?: string;
  content: string;
  onContentChange: (value: string) => void;
  onClose: () => void;
  onSend: () => void;
  /**
   * Extra content for the action being confirmed.
   *
   * Booking an interview has a precondition sending an email does not — the
   * round needs a prompt — and the confirmation is the last place it can be
   * caught before a candidate is told to attend.
   */
  extra?: ReactNode;
  /**
   * Holds Send shut for a reason the modal cannot see.
   *
   * Booking an interview can have nobody left to book — every selected
   * candidate already has that round open — and the modal has no way to know
   * that; the content in `extra` works it out and says why.
   */
  sendDisabled?: boolean;
  /**
   * The date and time here are the candidate's scheduled exam, not when the mail goes out (ack and reconfirmation).
   * The field says so, the preview shows the schedule with its timezone, and Send asks for one last confirmation.
   */
  isExamSchedule?: boolean;
}

/** Confirmation modal for a bulk email action (ack / rejection / exam link / …). */
export function BulkActionModal({
  title,
  hasDateTime,
  dateTimeRequired,
  recipientCount,
  sending,
  dateTime,
  onDateTimeChange,
  startDateTime,
  onStartDateTimeChange,
  minDateTime,
  content,
  onContentChange,
  onClose,
  onSend,
  extra,
  sendDisabled = false,
  isExamSchedule = false,
}: Readonly<BulkActionModalProps>) {
  // The picker blocks past times, but a value can still go stale while the
  // modal sits open — keep the guard on the Send button too.
  const scheduledInPast = !!dateTime && isPast(dateTime);
  const hasWindow = startDateTime !== undefined && !!onStartDateTimeChange;
  // A window that closes before it opens, or at the moment it opens, cannot be sat.
  const endBeforeStart =
    hasWindow && !!startDateTime && !!dateTime && dateTime <= startDateTime;
  const [confirming, setConfirming] = useState(false);
  const needsConfirm = isExamSchedule && !!dateTime;
  const examWhen = dateTime ? formatScheduleWithZone(dateTime) : "";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size="md"
      footer={
        confirming ? (
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirming(false)}
              disabled={sending}
            >
              Back
            </Button>
            <Button onClick={onSend} isLoading={sending}>
              Confirm &amp; send
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              onClick={needsConfirm ? () => setConfirming(true) : onSend}
              isLoading={sending}
              disabled={scheduledInPast || endBeforeStart || sendDisabled}
            >
              {needsConfirm ? "Review & send" : "Send"}
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="space-y-3 text-sm text-[var(--textSecondary)]">
          <p>
            Please check the exam schedule. This is what{" "}
            {recipientCount === 1
              ? "the candidate"
              : `all ${recipientCount} candidates`}{" "}
            will be told:
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-3">
            <CalendarClock
              size={18}
              className="mt-0.5 flex-shrink-0 text-[var(--primary)]"
            />
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--textTertiary)]">
                Scheduled exam
              </div>
              <div className="text-base font-semibold text-[var(--text)]">
                {examWhen}
              </div>
              <div className="text-xs text-[var(--textTertiary)]">
                Timezone: {BUSINESS_TIMEZONE}
              </div>
            </div>
          </div>
          <p>
            The email is sent to {recipientCount} candidate
            {recipientCount !== 1 ? "s" : ""} and shows this exact date and
            time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--textSecondary)]">
            Sending to <strong>{recipientCount}</strong> candidate
            {recipientCount !== 1 ? "s" : ""}.
          </p>

          {extra}

          {hasDateTime && (
            <div className="space-y-2">
              {/* Picker-only, so the past cannot be typed past `min`. The check
                below still runs: an open modal can outlive the slot it was
                showing, and arrow keys can still walk the value backwards. */}
              {hasWindow && (
                <DateTimeInput
                  label="Start date & time"
                  value={startDateTime ?? ""}
                  onChange={onStartDateTimeChange!}
                  min={minDateTime}
                  required
                  helperText="The interview opens for the candidate at this time"
                />
              )}
              <DateTimeInput
                label={
                  hasWindow
                    ? "End date & time"
                    : isExamSchedule
                      ? "Scheduled Exam Date & Time"
                      : "Date & Time"
                }
                value={dateTime}
                onChange={onDateTimeChange}
                min={hasWindow && startDateTime ? startDateTime : minDateTime}
                required={dateTimeRequired}
                helperText={
                  scheduledInPast || endBeforeStart
                    ? undefined
                    : hasWindow
                      ? "The interview closes at this time — after it, it can no longer be started"
                      : isExamSchedule
                        ? "The date and time the candidate must attend the exam. This is not when the email is sent."
                        : "Pick from the calendar — cannot be in the past"
                }
                error={
                  scheduledInPast
                    ? "That date & time has already passed"
                    : endBeforeStart
                      ? "The end must be after the start"
                      : undefined
                }
              />

              {/* Show the schedule exactly as the candidate will read it. Hidden
                once the slot is in the past: the field's own error already says
                so, and repeating it here just crowded the modal. */}
              {dateTime && !scheduledInPast && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--textSecondary)]">
                  <CalendarClock size={15} className="flex-shrink-0 mt-0.5" />
                  <span>
                    {isExamSchedule
                      ? "Exam scheduled for:"
                      : "Candidates will see:"}{" "}
                    <strong className="text-[var(--text)]">
                      {hasWindow && startDateTime
                        ? `${formatScheduleForEmail(startDateTime)} to ${formatScheduleForEmail(dateTime)}`
                        : isExamSchedule
                          ? examWhen
                          : formatScheduleForEmail(dateTime)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}

          <Textarea
            label="Message Content (optional)"
            placeholder="Enter custom message content..."
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            maxLength={2000}
            showCharCount
          />
        </div>
      )}
    </Modal>
  );
}
