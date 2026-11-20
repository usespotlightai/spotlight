import { StationIcon } from '@/components/features/board/column/StationIcon';
import { stationShare } from '@/lib/station';

type StationTagProps = {
  name: string;
  color: string;
  position: number;
  count: number;
};

export function StationTag({ name, color, position, count }: StationTagProps) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
      <StationIcon share={stationShare(position, count)} color={color} />
      {name}
    </span>
  );
}
