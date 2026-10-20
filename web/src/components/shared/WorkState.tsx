import { CircleDashed, Clock } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';
import type { Work } from '@/lib/run';

export function WorkState({ work }: { work: Work }) {
  return work === 'queued' ? (
    <Pill lead={<Clock className="size-3.5 shrink-0" aria-hidden />}>
      Queued
    </Pill>
  ) : (
    <Pill lead={<CircleDashed className="size-3.5 shrink-0" aria-hidden />}>
      In progress
    </Pill>
  );
}
