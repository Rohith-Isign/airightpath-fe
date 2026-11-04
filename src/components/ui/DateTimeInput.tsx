import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';

/**
 * A date-and-time field that can only be filled from a picker.
 *
 * It is two native fields side by side, a date and a time, not one `datetime-local`. The combined control opens a wide
 * two-pane popup (calendar and time columns) that does not fit a phone: it spilled outside the screen and covered the
 * form. A date field and a time field each open a small picker sized to the field, and on a phone each opens the
 * system's own sheet. The value is still the single `YYYY-MM-DDTHH:mm` string every caller already uses.
 *
 * Typed characters and pastes are dropped, so a value cannot be keyed in past the `min` the picker enforces.
 * Deliberately NOT the `readonly` attribute: `readonly` blocks the picker writing back as well, leaving the field
 * impossible to fill. Arrow keys, Tab, Backspace and Delete still work, so a keyboard-only user can set or clear it.
 * They can still land on an invalid moment, which is why `min` is never the only guard: every caller also renders an
 * error and re-checks on submit.
 */

/** Keys that navigate or adjust rather than type a value into a segment. */
const NAVIGATION_KEYS = new Set([
  'Tab',
  'Enter',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Backspace',
  'Delete',
]);

/** Time offered when a date is picked before any time has been. */
const DEFAULT_TIME = '09:00';

interface DateTimeInputProps {
  label: string;
  /** `YYYY-MM-DDTHH:mm`, or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable moment, as `YYYY-MM-DDTHH:mm`. */
  min?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

const guard = {
  onKeyDown: (event: React.KeyboardEvent) => {
    // Let shortcuts through — Ctrl/Cmd combinations are not value entry.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (NAVIGATION_KEYS.has(event.key)) return;
    event.preventDefault();
  },
  onPaste: (event: React.ClipboardEvent) => event.preventDefault(),
  onDrop: (event: React.DragEvent) => event.preventDefault(),
};

export function DateTimeInput({
  label,
  value,
  onChange,
  min,
  required,
  disabled,
  helperText,
  error,
  leftIcon,
}: Readonly<DateTimeInputProps>) {
  const [valueDate = '', valueTime = ''] = value ? value.split('T') : [];

  // Held locally as well, so a time picked before a date is not lost while the combined value is still empty.
  const [date, setDate] = useState(valueDate);
  const [time, setTime] = useState(valueTime);
  useEffect(() => {
    setDate(valueDate);
    setTime(valueTime);
  }, [valueDate, valueTime]);

  const [minDate = '', minTime = ''] = min ? min.split('T') : [];
  // The time floor only applies on the earliest day; any later day takes any time.
  const timeFloor = date && date === minDate ? minTime : undefined;

  function changeDate(next: string) {
    setDate(next);
    if (!next) {
      onChange('');
      return;
    }
    const nextTime = time || (next === minDate && minTime > DEFAULT_TIME ? minTime : DEFAULT_TIME);
    setTime(nextTime);
    onChange(`${next}T${nextTime}`);
  }

  function changeTime(next: string) {
    setTime(next);
    if (date && next) onChange(`${date}T${next}`);
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-[var(--text)] mb-2">
        {label}
        {required && <span className="text-[var(--error)] ml-0.5">*</span>}
      </label>
      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Input
          type="date"
          aria-label={`${label}: date`}
          value={date}
          min={minDate || undefined}
          required={required}
          disabled={disabled}
          leftIcon={leftIcon}
          onChange={(e) => changeDate(e.target.value)}
          {...guard}
        />
        <Input
          type="time"
          aria-label={`${label}: time`}
          value={time}
          min={timeFloor}
          required={required}
          disabled={disabled}
          onChange={(e) => changeTime(e.target.value)}
          {...guard}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-sm text-[var(--error)] flex items-center gap-1">{error}</p>
      ) : (
        helperText && <p className="mt-1.5 text-sm text-[var(--textSecondary)]">{helperText}</p>
      )}
    </div>
  );
}
