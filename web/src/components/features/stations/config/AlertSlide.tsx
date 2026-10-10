import {
  ArrowDownToLine,
  ArrowUpToLine,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AlertTrend } from '@/components/features/stations/config/AlertTrend';
import {
  type AlertThreshold,
  type AlertTrigger,
  alertFace,
  alertPhrase,
} from '@/lib/station-watch';

const ICONS: Record<AlertTrigger, typeof TrendingUp> = {
  rises: TrendingUp,
  falls: TrendingDown,
  above: ArrowUpToLine,
  below: ArrowDownToLine,
};

export function AlertSlide({ alert }: { alert: AlertThreshold }) {
  const face = alertFace(alert);
  const Icon = ICONS[face.trigger];

  return (
    <li
      aria-roledescription="slide"
      aria-label={alertPhrase(alert)}
      data-slot="alert-slide"
      className="w-44 max-w-[85%] shrink-0"
    >
      <div aria-hidden className="flex h-full flex-col justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-foreground text-xs">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{face.measure}</span>
        </span>

        <AlertTrend trigger={face.trigger} />

        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap text-[1.375rem] text-foreground tabular-nums leading-none tracking-tight">
            {face.threshold}
          </span>
          <span className="text-[0.7rem] text-muted-foreground">
            {face.window}
          </span>
        </div>
      </div>
    </li>
  );
}
