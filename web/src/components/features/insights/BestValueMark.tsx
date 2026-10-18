import { Trophy } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';

export function BestValueMark() {
  return (
    <WithTooltip tooltip="Best value">
      <span className="inline-flex shrink-0 text-muted-foreground">
        <Trophy aria-label="Best value" className="size-3" />
      </span>
    </WithTooltip>
  );
}
