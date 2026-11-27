import { CornerDownRight } from 'lucide-react';

import type { TaskMoveResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { since } from '@/lib/since';

type MoveMarkerProps = {
  move: TaskMoveResponseDto;
};

const movedTo = (move: TaskMoveResponseDto): string => {
  const to = `Moved to ${move.station ?? 'another station'}`;

  return move.person && nonEmpty(move.person.name)
    ? `${to} by ${move.person.name}`
    : to;
};

export function MoveMarker({ move }: MoveMarkerProps) {
  return (
    <li className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm">
      <CornerDownRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <span className="shrink-0 text-foreground">{movedTo(move)}</span>

      {nonEmpty(move.why) && (
        <span
          className="min-w-0 truncate text-muted-foreground"
          title={move.why}
        >
          {move.why}
        </span>
      )}

      <span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
        {since(move.at)}
      </span>
    </li>
  );
}
