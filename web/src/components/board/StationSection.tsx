import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Disclosure } from '@/components/layout/Disclosure';
import { cn } from '@/lib/utils';

type StationSectionProps = {
  name: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  to?: string;
  children?: ReactNode;
};

export function StationSection({
  name,
  count,
  open,
  onToggle,
  to,
  children,
}: StationSectionProps) {
  return (
    <section data-slot="station-section" className="flex flex-col">
      <header className="sticky top-0 z-10 mx-1.5 flex h-9 shrink-0 items-center gap-2 rounded-md bg-accent px-1.5">
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

        <h2 className="flex min-w-0 font-medium text-foreground text-sm">
          {to ? (
            <Link
              to={to}
              className="truncate rounded-md px-1.5 py-0.5 outline-none transition-colors hover:bg-foreground/10"
            >
              {name}
            </Link>
          ) : (
            <span className="truncate">{name}</span>
          )}
        </h2>

        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      </header>

      <Disclosure open={open} slot="station-tasks" className="gap-0 pt-0">
        {children}
      </Disclosure>
    </section>
  );
}
