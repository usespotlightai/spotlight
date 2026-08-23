import type { ReactNode } from 'react';

type StationLaneProps = {
  name: string;
  count: number;
  children?: ReactNode;
};

export function StationLane({ name, count, children }: StationLaneProps) {
  return (
    <section
      data-slot="station-lane"
      className="flex h-full w-[26rem] shrink-0 flex-col rounded-lg border-[0.5px] border-border bg-background"
    >
      <header className="flex h-9 shrink-0 items-center gap-2 px-3">
        <h2 className="truncate font-medium text-foreground text-sm">{name}</h2>
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
        {count === 0 ? (
          <p className="px-1 py-1 text-muted-foreground text-xs">
            Nothing here
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
