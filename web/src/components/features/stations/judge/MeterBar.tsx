import { cn } from '@/lib/utils';

const percent = (value: number): string =>
  `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;

type MeterBarProps = {
  share: number | null;
  marker?: number | null;
  failing?: boolean;
  className?: string;
};

export function MeterBar({
  share,
  marker = null,
  failing = false,
  className,
}: MeterBarProps) {
  return (
    <span
      aria-hidden
      data-slot="meter-bar"
      data-failing={failing}
      className={cn('relative block h-1.5 rounded-full bg-muted', className)}
    >
      {share !== null && (
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            failing ? 'bg-outcome-failed' : 'bg-chart-primary',
          )}
          style={{ width: percent(share) }}
        />
      )}
      {marker !== null && (
        <span
          className="absolute -inset-y-1 w-px bg-foreground/40"
          style={{ left: percent(marker) }}
        />
      )}
    </span>
  );
}
