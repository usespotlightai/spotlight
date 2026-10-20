import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ARRIVING } from '@/lib/inbox';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type InboxWorkingProps = {
  station: string;
  stationColor: string;
  stationPosition: number;
  stationCount: number;
  queued?: boolean;
};

export function InboxWorking({
  station,
  stationColor,
  stationPosition,
  stationCount,
  queued = false,
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
      {queued ? (
        <span className="text-muted-foreground">
          Queued. {station} starts when a runner is free.
        </span>
      ) : (
        <span className="animate-pulse">{station} is working…</span>
      )}
    </li>
  );
}
