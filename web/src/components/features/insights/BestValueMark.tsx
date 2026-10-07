import { Trophy } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';

export function BestValueMark() {
  return (
    <Noted note="Best value">
      <span className="inline-flex shrink-0 text-muted-foreground">
        <Trophy aria-label="Best value" className="size-3" />
      </span>
    </Noted>
  );
}
