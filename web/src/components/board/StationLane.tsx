import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type StationLaneProps = {
  name: string;
  count: number;
  customizeTo?: string;
  children?: ReactNode;
};

export function StationLane({
  name,
  count,
  customizeTo,
  children,
}: StationLaneProps) {
  return (
    <section
      data-slot="station-lane"
      className="group/lane flex h-full w-[26rem] shrink-0 flex-col rounded-lg border-[0.5px] border-border bg-background"
    >
      <header className="flex h-9 shrink-0 items-center gap-2 px-3">
        <h2 className="min-w-0 truncate font-medium text-foreground text-sm">
          {name}
        </h2>
        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {count}
        </span>

        {customizeTo && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${name} options`}
              className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 outline-none transition-[opacity,color,background-color] hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 group-hover/lane:opacity-100 data-[popup-open]:bg-foreground/10 data-[popup-open]:text-foreground data-[popup-open]:opacity-100"
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="min-w-36"
            >
              <DropdownMenuItem
                closeOnClick
                render={<Link to={customizeTo}>Customize station</Link>}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
