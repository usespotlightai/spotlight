import { Info } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

export function InfoTooltip({ tooltip }: { tooltip: TooltipText }) {
  return (
    <WithTooltip tooltip={tooltip}>
      <span className="inline-flex text-muted-foreground hover:text-foreground">
        <Info aria-hidden className="size-3.5" />
      </span>
    </WithTooltip>
  );
}
