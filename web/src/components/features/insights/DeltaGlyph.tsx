import { Triangle } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import type { ShownDelta } from '@/lib/insights';
import { cn } from '@/lib/utils';

const TONES: Record<ShownDelta['tone'], string> = {
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-destructive',
  flat: 'text-muted-foreground',
};

type DeltaGlyphProps = {
  delta: ShownDelta;
  tooltip?: string;
};

export function DeltaGlyph({ delta, tooltip }: DeltaGlyphProps) {
  const up = delta.shown.startsWith('+') || delta.shown.startsWith('Up');
  const down = /^[-−]/.test(delta.shown);

  const mark = (
    <span
      data-slot="delta"
      data-tone={delta.tone}
      className="inline-flex items-center justify-end gap-[0.4em] whitespace-nowrap align-top leading-4 tabular-nums"
    >
      {(up || down) && (
        <Triangle
          aria-hidden
          className={cn(
            'size-[0.7em] shrink-0 fill-current',
            TONES[delta.tone],
            down && 'rotate-180',
          )}
        />
      )}
      <span
        className={
          up || down ? 'font-medium text-foreground' : 'text-muted-foreground'
        }
      >
        {delta.shown}
      </span>
    </span>
  );

  return tooltip ? <WithTooltip tooltip={tooltip}>{mark}</WithTooltip> : mark;
}
