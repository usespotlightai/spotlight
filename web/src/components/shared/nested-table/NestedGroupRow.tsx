import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  OUTER_DIVIDER,
  OUTER_GUIDE,
  OUTER_INDENT,
} from '@/components/shared/nested-table/nested-rows';
import { cn } from '@/lib/utils';

type NestedGroupRowProps = {
  label: string;
  open: boolean;
  depth: 0 | 1;
  onToggle?: () => void;
  cells?: ReactNode;
  spans?: string;
  children: ReactNode;
};

export function NestedGroupRow({
  label,
  open,
  depth,
  onToggle,
  cells,
  spans = '@4xl:col-span-1',
  children,
}: NestedGroupRowProps) {
  const named = (
    <>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Fold ${label}` : `Unfold ${label}`}
          onClick={onToggle}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3 transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
        </button>
      ) : (
        <span aria-hidden className="size-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1 text-xs">{children}</div>
    </>
  );

  return (
    <li
      data-slot="nested-group"
      className={cn(
        'relative col-span-full min-h-7 min-w-0 items-center py-1 pr-2',
        cells
          ? 'grid grid-cols-2 gap-x-6 gap-y-1 @4xl:grid-cols-subgrid'
          : 'flex gap-1.5',
        depth === 0
          ? 'border-border border-t bg-surface pl-2 first:border-t-0'
          : cn(OUTER_INDENT, OUTER_GUIDE, OUTER_DIVIDER),
      )}
    >
      {cells ? (
        <>
          <div
            className={cn(
              'col-span-full flex min-w-0 items-center gap-1.5',
              spans,
            )}
          >
            {named}
          </div>
          {cells}
        </>
      ) : (
        named
      )}
    </li>
  );
}
