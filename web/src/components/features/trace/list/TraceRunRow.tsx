import { StationIcon } from '@/components/features/board/column/StationIcon';
import { TRACE_COLUMNS } from '@/components/features/trace/list/columns';
import { ProgressState } from '@/components/shared/ProgressState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { HarnessResponseDto } from '@/lib/api';
import { formatShortDuration } from '@/lib/inbox';
import {
  formatHarness,
  formatModel,
  formatPerson,
  formatSpend,
  type PersonName,
  type TraceRun,
} from '@/lib/insights';
import { stationShare } from '@/lib/station';
import { endedBadly, formatEnding } from '@/lib/station-insights';
import { startedOn } from '@/lib/trace-list';
import { cn } from '@/lib/utils';

type TraceRunRowProps = {
  run: TraceRun;
  to: string;
  people: readonly PersonName[];
  harnesses: readonly HarnessResponseDto[] | undefined;
};

export function TraceRunRow({ run, to, people, harnesses }: TraceRunRowProps) {
  const details = [
    formatPerson(people, run.openedBy),
    formatHarness(harnesses, run.harness),
    formatModel(run.model),
  ];

  return (
    <li
      data-slot="trace-run"
      className={cn(
        'relative grid h-8 items-center gap-3 rounded-md px-3 text-xs transition-colors hover:bg-accent',
        TRACE_COLUMNS,
      )}
    >
      <span aria-hidden />

      <span className="truncate text-muted-foreground tabular-nums">
        {startedOn(run.startedAt)}
      </span>

      <span className="flex items-center" title={run.station?.name}>
        {run.station && (
          <StationIcon
            share={stationShare(run.station.position, run.station.count)}
            color={run.station.color}
          />
        )}
      </span>

      <span className="col-span-3 flex min-w-0 items-center gap-2">
        <TrailLink
          to={to}
          title={run.failure ?? undefined}
          className={cn(
            'shrink-0 font-medium outline-none after:absolute after:inset-0 after:rounded-md',
            run.ending && endedBadly(run.ending)
              ? 'text-destructive'
              : 'text-foreground',
          )}
        >
          {run.progress ? (
            <ProgressState progress={run.progress} />
          ) : (
            run.ending && formatEnding(run.ending)
          )}
        </TrailLink>

        {run.failure && (
          <span className="pointer-events-none min-w-0 truncate text-destructive">
            {run.failure}
          </span>
        )}

        <span className="min-w-0 truncate text-muted-foreground">
          {details.join(' · ')}
        </span>
      </span>

      <span
        className={cn(
          'truncate text-right tabular-nums',
          run.errors ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {run.errors || '–'}
      </span>

      <span className="truncate text-right text-muted-foreground tabular-nums">
        {run.ms === null ? '–' : formatShortDuration(run.ms)}
      </span>

      <span className="truncate text-right text-muted-foreground tabular-nums">
        {formatSpend(run.cost)}
      </span>
    </li>
  );
}
