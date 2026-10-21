import { CircleDashed, CircleStop, Clock } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';
import type { Progress } from '@/lib/run';

export function ProgressState({ progress }: { progress: Progress }) {
  if (progress === 'stopping') {
    return (
      <Pill lead={<CircleStop className="size-3.5 shrink-0" aria-hidden />}>
        Stopping
      </Pill>
    );
  }

  return progress === 'queued' ? (
    <Pill lead={<Clock className="size-3.5 shrink-0" aria-hidden />}>
      Queued
    </Pill>
  ) : (
    <Pill lead={<CircleDashed className="size-3.5 shrink-0" aria-hidden />}>
      In progress
    </Pill>
  );
}
