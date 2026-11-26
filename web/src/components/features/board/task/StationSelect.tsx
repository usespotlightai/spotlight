import { ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCommands } from '@/hooks/useCommands';
import { useMe } from '@/hooks/useMe';
import type { StationResponseDto, TaskHoldResponseDto } from '@/lib/api';
import { heldUntilResumed, lockedHold } from '@/lib/hold';
import { stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

type Station = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly kind: StationResponseDto['kind'];
};

type StationSelectProps = {
  stations: readonly Station[];
  value: string;
  held: TaskHoldResponseDto | null;
  movableTo: readonly string[];
  onChange: (stationId: string) => void;
};

export function StationSelect({
  stations,
  value,
  held,
  movableTo,
  onChange,
}: StationSelectProps) {
  const shareOf = (stationId: string) =>
    stationShare(
      stations.findIndex((each) => each.id === stationId),
      stations.length,
    );

  const currentStation = stations.find((each) => each.id === value);
  const movable = new Set(movableTo);
  const offered = stations.filter((each) => movable.has(each.id));
  const [open, setOpen] = useState(false);
  const me = useMe();
  const locked = lockedHold(held);
  useCommands(
    offered.length > 1
      ? [
          {
            id: 'task.station',
            run: () => setOpen(true),
            enabled: () => !locked,
          },
        ]
      : [],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              disabled={Boolean(locked)}
              aria-label="Station"
              className={cn(
                'group/station flex h-7 pointer-coarse:h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors data-[popup-open]:bg-accent',
                !locked && 'hover:bg-accent',
              )}
            />
          }
        >
          <StationIcon
            share={shareOf(value)}
            color={currentStation?.color}
            className={cn(
              'transition-[filter]',
              !locked && 'group-hover/station:brightness-90',
            )}
          />
          <span className="truncate text-foreground">
            {currentStation?.name}
          </span>
          {!locked && (
            <ChevronsUpDown
              className="ml-auto size-3 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {locked ? (
            heldUntilResumed(locked, me?.id)
          ) : (
            <ShortcutHint id="task.station">
              {held
                ? 'Move to a station and resume the line'
                : 'Move to a station'}
            </ShortcutHint>
          )}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-52">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          {offered.map((station) => (
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
