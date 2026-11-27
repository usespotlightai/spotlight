import { ChevronsUpDown } from 'lucide-react';
import { useId, useState } from 'react';

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
import type {
  StationResponseDto,
  TaskHandMoveResponseDto,
  TaskHoldResponseDto,
} from '@/lib/api';
import { heldUntilResumed, lockedHold } from '@/lib/hold';
import { stationShare } from '@/lib/station';
import { handMoveDenial, handMoveHint } from '@/lib/task';
import { cn } from '@/lib/utils';

type Station = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly kind: StationResponseDto['kind'];
};

type StationOptionProps = {
  station: Station;
  share: number;
  hint: string | null;
  denied: boolean;
};

function StationOption({ station, share, hint, denied }: StationOptionProps) {
  const nameId = useId();
  const hintId = useId();

  return (
    <DropdownMenuRadioItem
      value={station.id}
      disabled={denied}
      aria-labelledby={nameId}
      aria-describedby={hint ? hintId : undefined}
      className="group/option"
    >
      <StationIcon
        share={share}
        color={station.color}
        className="transition-[filter] group-focus/option:brightness-90"
      />
      <span className="flex min-w-0 flex-col">
        <span id={nameId} className="truncate">
          {station.name}
        </span>
        {hint && (
          <span id={hintId} className="truncate text-muted-foreground text-xs">
            {hint}
          </span>
        )}
      </span>
    </DropdownMenuRadioItem>
  );
}

type StationSelectProps = {
  stations: readonly Station[];
  value: string;
  held: TaskHoldResponseDto | null;
  handMoves: readonly TaskHandMoveResponseDto[];
  onChange: (stationId: string) => void;
};

export function StationSelect({
  stations,
  value,
  held,
  handMoves,
  onChange,
}: StationSelectProps) {
  const shareOf = (stationId: string) =>
    stationShare(
      stations.findIndex((each) => each.id === stationId),
      stations.length,
    );

  const currentStation = stations.find((each) => each.id === value);
  const offered = stations.flatMap((station) => {
    const move = handMoves.find((each) => each.stationId === station.id);

    return move ? [{ station, move }] : [];
  });
  const [open, setOpen] = useState(false);
  const me = useMe();
  const locked = lockedHold(held);
  const stays = handMoveDenial({ stationId: value, handMoves });
  const shown = stays
    ? offered.filter(({ station }) => station.id === value)
    : offered;
  useCommands(
    shown.length > 1
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

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-60">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          {shown.map(({ station, move }) => (
            <StationOption
              key={station.id}
              station={station}
              share={shareOf(station.id)}
              hint={handMoveHint(move, stations)}
              denied={move.denial !== null}
            />
          ))}
        </DropdownMenuRadioGroup>
        {stays && (
          <p className="px-1.5 py-1 text-muted-foreground text-xs">{stays}</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
