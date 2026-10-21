import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ARRIVING } from '@/lib/inbox';
import type { Activity } from '@/lib/run';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type InboxWorkingProps = {
  station: string;
  stationColor: string;
  stationPosition: number;
  stationCount: number;
  activity: Activity;
};

const textOf = (activity: Activity, station: string): string =>
  ({
    queued: `Queued. ${station} starts when a runner is free.`,
    working: `${station} is working…`,
    stopping: 'Stopping…',
    finishing: 'Agent stopped. Finishing the run…',
  })[activity];

export function InboxWorking({
  station,
  stationColor,
  stationPosition,
  stationCount,
  activity,
}: InboxWorkingProps) {
  return (
    <li
      className={cn(
        'flex items-center gap-1.5 px-1 pt-3 pb-0.5 text-xs leading-6',
        ARRIVING,
      )}
    >
      <StationIcon
        share={stationShare(stationPosition, stationCount)}
        color={stationColor}
      />
      <span
        className={cn(
          activity !== 'queued' && 'animate-pulse',
          activity !== 'working' && 'text-muted-foreground',
        )}
      >
        {textOf(activity, station)}
      </span>
    </li>
  );
}
