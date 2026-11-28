import { Info } from 'lucide-react';

import { TappableTooltip } from '@/components/shared/TappableTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

export function InfoTooltip({ tooltip }: { tooltip: TooltipText }) {
  return (
    <TappableTooltip tooltip={tooltip} delay={100} trackCursorAxis="none">
      <span className="relative inline-flex text-muted-foreground hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5">
        <Info aria-hidden className="size-3.5" />
      </span>
    </TappableTooltip>
  );
}
