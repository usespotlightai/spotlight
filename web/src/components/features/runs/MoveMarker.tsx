import { CornerDownRight } from 'lucide-react';

import { since } from '@/lib/since';

type MoveMarkerProps = {
  body: string;
  at: string;
};

export function MoveMarker({ body, at }: MoveMarkerProps) {
  const [said = body] = body.split('\n');

  return (
    <li className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-muted-foreground text-sm">
      <CornerDownRight className="size-4 shrink-0" aria-hidden />

      <span className="truncate" title={body}>
        {said}
      </span>

      <span className="ml-auto shrink-0 text-xs tabular-nums">{since(at)}</span>
    </li>
  );
}
