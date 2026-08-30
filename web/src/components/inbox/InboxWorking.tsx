import { StationIcon } from '@/components/board/StationIcon';
import { stationShare } from '@/lib/station';

type InboxWorkingProps = {
  station: string;
  stationColor: string;
  stationPosition: number;
  stationCount: number;
};

/**
 * A run is on it. Shown while the answer is still being written, so an
 * answered question does not look like an ignored one.
 */
export function InboxWorking({
  station,
  stationColor,
  stationPosition,
  stationCount,
}: InboxWorkingProps) {
  return (
    <li className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <StationIcon
        share={stationShare(stationPosition, stationCount)}
        color={stationColor}
      />
      <span className="animate-pulse">{station} is working…</span>
    </li>
  );
}
