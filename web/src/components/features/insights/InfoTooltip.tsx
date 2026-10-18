import { Info } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';

export function InfoTooltip({ tooltip }: { tooltip: string }) {
  return (
    <WithTooltip tooltip={tooltip}>
      <span className="inline-flex text-muted-foreground hover:text-foreground">
        <Info aria-hidden className="size-3.5" />
      </span>
    </WithTooltip>
  );
}
