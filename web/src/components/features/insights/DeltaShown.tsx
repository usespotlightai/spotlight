import type { Delta } from '@/lib/insights';
import { cn } from '@/lib/utils';

const TONES: Record<Delta['tone'], string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  bad: 'bg-destructive/10 text-destructive',
  flat: 'bg-muted text-muted-foreground',
};

export function DeltaShown({
  delta,
  against = 'previous period',
  compact = false,
}: {
  delta: Delta;
  against?: string | null;
  compact?: boolean;
}) {
  return (
    <span
      data-slot="delta"
      data-tone={delta.tone}
      className={cn(
        'w-fit rounded px-1 py-px text-[0.7rem] tabular-nums',
        TONES[delta.tone],
      )}
    >
      {delta.shown}
      {against && (
        <span
          className={cn('opacity-80', compact && 'hidden @min-[12rem]:inline')}
        >
          {' '}
          vs. {against}
        </span>
      )}
    </span>
  );
}
