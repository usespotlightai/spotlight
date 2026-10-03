import {
  Check,
  CircleDashed,
  Hourglass,
  type LucideIcon,
  TriangleAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Noted } from '@/components/shared/Noted';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  compactHealthLabelShown,
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

type HealthLineProps = {
  reading: HealthReading;
  compact?: boolean;
  replayTo?: string | null;
  children?: ReactNode;
};

export function HealthLine({
  reading,
  compact = false,
  replayTo = null,
  children,
}: HealthLineProps) {
  const Icon = ICONS[reading.tone];
  const said = (
    <span
      data-slot="health-said"
      className={cn('inline-flex items-center gap-1', TONES[reading.tone])}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      {reading.said}
    </span>
  );

  if (compact) {
    return (
      <li
        data-slot="health-line"
        data-key={reading.key}
        data-tone={reading.tone}
        className="flex min-w-0 items-center gap-1 text-xs"
      >
        <span className="text-muted-foreground">
          {compactHealthLabelShown(reading.label)}
        </span>{' '}
        <Noted note={reading.advice}>{said}</Noted>
      </li>
    );
  }

  return (
    <li
      data-slot="health-line"
      data-key={reading.key}
      data-tone={reading.tone}
      className="flex flex-col gap-1 border-border border-t py-2 first:border-t-0 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
        <span className="font-medium text-foreground sm:w-44 sm:shrink-0">
          {reading.label}
        </span>
        {said}
        {replayTo && (
          <TrailLink
            to={replayTo}
            className="ml-auto text-foreground underline-offset-2 hover:underline"
          >
            {HEALTH_REPLAY_LINK}
          </TrailLink>
        )}
      </div>
      <p className="text-muted-foreground text-xs leading-5 sm:pl-47">
        {reading.advice}
      </p>
      {children && <div className="sm:pl-47">{children}</div>}
    </li>
  );
}
