import { ChevronDown, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { Disclosure } from '@/components/layout/Disclosure';
import { cn } from '@/lib/utils';

type StationSectionProps = {
  name: string;
  count: number;
  color: string;
  selectedCount: number;
  open: boolean;
  onToggle: () => void;
  share: number;
  to?: string;
  onAddTask?: () => void;
  children?: ReactNode;
};

export function StationSection({
  name,
  count,
  color,
  selectedCount,
  open,
  onToggle,
  share,
  to,
  onAddTask,
  children,
}: StationSectionProps) {
  return (
    <section data-slot="station-section" className="flex flex-col">
      <header
        style={{
          backgroundImage: `linear-gradient(to right, ${color}1f, transparent 60%)`,
        }}
        className="sticky top-0 z-10 mx-1.5 flex h-9 shrink-0 items-center gap-2 rounded-md bg-accent px-3"
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={name}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn('size-3 transition-transform', !open && '-rotate-90')}
            aria-hidden
          />
        </button>

        <StationIcon share={share} color={color} className="-mr-1.5" />

        <h2 className="flex min-w-0 font-medium text-foreground text-sm">
          {to ? (
            <Link to={to} className="truncate px-1.5 py-0.5 outline-none">
              {name}
            </Link>
          ) : (
            <span className="truncate">{name}</span>
          )}
        </h2>

        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {count}
        </span>

        {!open && selectedCount > 0 && (
          <span className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs tabular-nums">
            <span aria-hidden>•</span>
            {selectedCount} selected
          </span>
        )}

        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            aria-label={`Add task to ${name}`}
            className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        )}
      </header>

      <Disclosure open={open} slot="station-tasks" className="gap-0">
        {children}
      </Disclosure>
    </section>
  );
}
