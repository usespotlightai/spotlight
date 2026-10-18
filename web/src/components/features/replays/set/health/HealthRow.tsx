import {
  Check,
  CircleDashed,
  Hourglass,
  type LucideIcon,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { InfoTooltip } from '@/components/features/insights/InfoTooltip';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  HEALTH_REPLAY_LINK,
  type HealthReading,
  type HealthTone,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const TONES: Record<HealthTone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-amber-700 dark:text-amber-400',
  pending: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
};

const ICONS: Record<HealthTone, LucideIcon> = {
  good: Check,
  bad: TriangleAlert,
  pending: Hourglass,
  unknown: CircleDashed,
};

type HealthRowProps = {
  reading: HealthReading;
  replayTo: string | null;
  children?: ReactNode;
};

export function HealthRow({ reading, replayTo, children }: HealthRowProps) {
  const Icon = ICONS[reading.tone];

  return (
    <li
      data-slot="health-line"
      data-key={reading.key}
      data-tone={reading.tone}
      className={cn(TABLE_ROW, ROW_DIVIDER, 'items-start')}
    >
      <span className={cn(LEAD_CELL, EDGE_INDENT, 'gap-1.5')}>
        <span className="truncate font-medium text-foreground">
          {reading.label}
        </span>
        <InfoTooltip tooltip={reading.advice} />
      </span>
      <span className="col-span-full flex min-w-0 flex-col gap-1 @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3">
          <span
            data-slot="health-text"
            className={cn(
              'inline-flex items-center gap-2',
              TONES[reading.tone],
            )}
          >
            <Icon aria-hidden className="size-3 shrink-0" />
            {reading.text}
          </span>
          {replayTo && (
            <TrailLink
              to={replayTo}
              className="ml-auto text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {HEALTH_REPLAY_LINK}
            </TrailLink>
          )}
        </span>
        {children}
      </span>
    </li>
  );
}
