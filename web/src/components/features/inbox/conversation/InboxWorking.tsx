import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ARRIVING } from '@/lib/inbox';
import type { ShownProgress } from '@/lib/run';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type InboxWorkingProps = {
  station: string;
  stationColor: string;
  stationPosition: number;
  stationCount: number;
  progress: ShownProgress;
};

export function InboxWorking({
  station,
  stationColor,
  stationPosition,
  stationCount,
  progress,
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
      {progress === 'queued' ? (
        <span className="text-muted-foreground">
          Queued. {station} starts when a runner is free.
        </span>
      ) : progress === 'in-progress' ? (
        <span className="animate-pulse">{station} is working…</span>
      ) : (
        <span className="animate-pulse text-muted-foreground">
          {progress === 'finishing'
            ? 'Agent stopped. Finishing the run…'
            : 'Stopping…'}
        </span>
      )}
    </li>
  );
}
