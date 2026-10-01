import type { Delta } from '@/lib/insights';
import { cn } from '@/lib/utils';

const TONES: Record<Delta['tone'], string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-destructive',
  flat: 'text-muted-foreground',
};

export function DeltaShown({
  delta,
  against = 'last period',
}: {
  delta: Delta;
  against?: string | null;
}) {
  return (
    <span
      data-slot="delta"
      data-tone={delta.tone}
      className={cn('text-xs tabular-nums', TONES[delta.tone])}
    >
      {delta.shown}
      {against && <span className="text-muted-foreground"> vs {against}</span>}
    </span>
  );
}
