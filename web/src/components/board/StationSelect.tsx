import { ChevronsUpDown } from 'lucide-react';
import { StationIcon } from '@/components/board/StationIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { stationShare } from '@/lib/station';

type Station = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
};

type StationSelectProps = {
  stations: readonly Station[];
  value: string;
  onChange: (stationId: string) => void;
};

export function StationSelect({
  stations,
  value,
  onChange,
}: StationSelectProps) {
  const shareOf = (stationId: string) =>
    stationShare(
      stations.findIndex((each) => each.id === stationId),
      stations.length,
    );

  const standing = stations.find((each) => each.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Station"
        className="group/station flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
      >
        <StationIcon
          share={shareOf(value)}
          color={standing?.color}
          className="transition-[filter] group-hover/station:brightness-90"
        />
        <span className="truncate text-foreground">{standing?.name}</span>
        <ChevronsUpDown
          className="ml-auto size-3 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          {stations.map((station) => (
            <DropdownMenuRadioItem
              key={station.id}
              value={station.id}
              className="group/option"
            >
              <StationIcon
                share={shareOf(station.id)}
                color={station.color}
                className="transition-[filter] group-focus/option:brightness-90"
              />
              <span className="truncate">{station.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
