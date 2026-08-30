import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DropIndicator } from '@/components/board/DropIndicator';
import { StationIcon } from '@/components/board/StationIcon';
import { Disclosure } from '@/components/layout/Disclosure';
import { cn } from '@/lib/utils';

type StationSectionProps = {
  id: string;
  name: string;
  count: number;
  color: string;
  selectedCount: number;
  open: boolean;
  onToggle: () => void;
  share: number;
  to?: string;
  onAddTask?: () => void;
  landing?: boolean;
  landingEdge?: 'top' | 'bottom';
  fixed?: boolean;
  children?: ReactNode;
};

export function StationSection({
  id,
  name,
  count,
  color,
  selectedCount,
  open,
  onToggle,
  share,
  to,
  onAddTask,
  landing,
  landingEdge,
  fixed,
  children,
}: StationSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { kind: 'station', fixed },
    disabled: fixed,
    animateLayoutChanges: () => false,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-slot="station-section"
      className={cn('relative flex flex-col', isDragging && 'opacity-40')}
    >
      {landingEdge && <DropIndicator edge={landingEdge} />}

      <header
        {...(fixed ? {} : attributes)}
        {...(fixed ? {} : listeners)}
        style={{
          backgroundImage: `linear-gradient(to right, ${color}1f, transparent 60%)`,
        }}
        className="sticky top-0 z-10 mx-1.5 relative flex h-9 shrink-0 touch-none select-none items-center gap-2 rounded-md bg-accent px-3"
      >
        {landing && <DropIndicator edge="bottom" />}

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
            <Link
              to={to}
              draggable={false}
              className="truncate px-1.5 py-0.5 outline-none"
            >
              {name}
            </Link>
          ) : (
            <span className="truncate px-1.5 py-0.5">{name}</span>
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
