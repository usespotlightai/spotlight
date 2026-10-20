import { CircleDashed, Clock } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';

export function WorkState({ queued }: { queued: boolean }) {
  return queued ? (
    <Pill lead={<Clock className="size-3.5 shrink-0" aria-hidden />}>
      Queued
    </Pill>
  ) : (
    <Pill lead={<CircleDashed className="size-3.5 shrink-0" aria-hidden />}>
      In progress
    </Pill>
  );
}
