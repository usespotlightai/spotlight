import { Noted } from '@/components/shared/Noted';
import { kappaNote, statShown } from '@/lib/judge';

const percent = (value: number): string =>
  `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;

type KappaBarProps = {
  kappa: number | null;
  trust: number | null;
};

export function KappaBar({ kappa, trust }: KappaBarProps) {
  return (
    <Noted note={kappaNote(kappa)}>
      <span className="flex min-w-0 cursor-default items-center gap-2">
        <span className="w-8 shrink-0 text-foreground tabular-nums">
          {statShown(kappa)}
        </span>
        <span
          aria-hidden
          className="relative h-1.5 min-w-12 flex-1 rounded-full bg-muted"
        >
          {kappa !== null && (
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-chart-primary"
              style={{ width: percent(kappa) }}
            />
          )}
          {trust !== null && (
            <span
              className="absolute -inset-y-1 w-px bg-foreground/40"
              style={{ left: percent(trust) }}
            />
          )}
        </span>
      </span>
    </Noted>
  );
}
