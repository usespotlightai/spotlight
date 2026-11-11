import { Inbox } from 'lucide-react';

import { Pill } from '@/components/shared/Pill';

export function WaitingForYouPill() {
  return (
    <Pill lead={<Inbox className="size-3.5 shrink-0" aria-hidden />}>
      Waiting for you
    </Pill>
  );
}
