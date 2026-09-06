import { StationIcon } from '@/components/features/board/column/StationIcon';
import { stationShare } from '@/lib/station';

type InboxWorkingProps = {
  station: string;
  stationColor: string;
  stationPosition: number;
  stationCount: number;
};

export function InboxWorking({
  station,
  stationColor,
  stationPosition,
  stationCount,
}: InboxWorkingProps) {
  return (
    <li className="flex items-center gap-1.5 px-1 pt-3 pb-0.5 text-xs leading-6">
      <span className="flex size-6 shrink-0 items-center justify-center">
        <StationIcon
          share={stationShare(stationPosition, stationCount)}
          color={stationColor}
        />
      </span>
      <span className="animate-pulse">{station} is working…</span>
    </li>
  );
}
