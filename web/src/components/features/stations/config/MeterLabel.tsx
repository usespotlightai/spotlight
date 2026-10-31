import type { ReactNode } from 'react';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

export function MeterLabel({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: ReactNode;
  tooltip?: TooltipText | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        {label}
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  );
}
