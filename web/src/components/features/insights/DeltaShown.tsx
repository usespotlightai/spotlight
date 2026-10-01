import type { Delta } from '@/lib/insights';
import { cn } from '@/lib/utils';

const TONES: Record<Delta['tone'], string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-destructive',
  flat: 'text-muted-foreground',
};

export function DeltaShown({ delta }: { delta: Delta }) {
  return (
    <span
      data-slot="delta"
      data-tone={delta.tone}
      className={cn('text-xs tabular-nums', TONES[delta.tone])}
    >
      {delta.shown}
      <span className="text-muted-foreground"> vs last period</span>
    </span>
  );
}
