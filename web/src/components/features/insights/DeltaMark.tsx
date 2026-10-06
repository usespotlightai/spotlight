import { Triangle } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';
import type { Delta } from '@/lib/insights';
import { cn } from '@/lib/utils';

const TONES: Record<Delta['tone'], string> = {
  good: 'text-emerald-700 dark:text-emerald-400',
  bad: 'text-destructive',
  flat: 'text-muted-foreground',
};

type DeltaMarkProps = {
  delta: Delta;
  note?: string;
};

export function DeltaMark({ delta, note }: DeltaMarkProps) {
  const up = delta.shown.startsWith('+') || delta.shown.startsWith('Up');
  const down = /^[-−]/.test(delta.shown);

  const mark = (
    <span
      data-slot="delta"
      data-tone={delta.tone}
      className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap align-top leading-4 tabular-nums"
    >
      {(up || down) && (
        <Triangle
          aria-hidden
          className={cn(
            'size-2.5 shrink-0 fill-current',
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

  return note ? <Noted note={note}>{mark}</Noted> : mark;
}
