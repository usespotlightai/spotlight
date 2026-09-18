import { CircleDashed } from 'lucide-react';
import { Pill } from '@/components/shared/Pill';

export function InProgress() {
  return (
    <Pill lead={<CircleDashed className="size-3.5 shrink-0" aria-hidden />}>
      In progress
    </Pill>
  );
}
