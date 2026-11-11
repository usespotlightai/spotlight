import { Eye, EyeOff } from 'lucide-react';

import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { ScoreVisibility } from '@/lib/judge';
import { cn } from '@/lib/utils';

export function ScoreVisibilityLine({
  visibility,
}: {
  visibility: ScoreVisibility;
}) {
  const Icon = visibility.hidden ? EyeOff : Eye;

  return (
    <p
      data-slot="score-visibility"
      data-hidden={visibility.hidden}
      className="flex items-start gap-2 text-muted-foreground text-sm leading-5"
    >
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-4 shrink-0',
          visibility.failing && 'text-outcome-failed',
        )}
      />
      <span className="flex items-center gap-1.5">
        {visibility.text}
        {visibility.reason && <InfoTooltip tooltip={visibility.reason} />}
      </span>
    </p>
  );
}
