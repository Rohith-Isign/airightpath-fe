import { MonitorX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Shown instead of the exam when it is already open in another browser or tab. An exam runs in one place at a time;
 * the candidate continues where it is open, or closes it there and comes back here.
 */
export function ExamOpenElsewhere({
  message,
  onBack,
}: Readonly<{ message?: string | null; onBack: () => void }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md text-center">
        <MonitorX className="mx-auto mb-4 h-12 w-12 text-amber-500" />
        <h2 className="mb-2 text-xl font-bold text-[var(--text)]">Already open somewhere else</h2>
        <p className="mb-6 text-[var(--textSecondary)]">
          {message ??
            'This exam is already open in another browser or tab. Continue it there, or close it and try again here in a minute.'}
        </p>
        <Button onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}
