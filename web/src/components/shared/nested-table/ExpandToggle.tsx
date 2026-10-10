import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Expansion } from '@/components/shared/nested-table/ExpandingRow';
import { cn } from '@/lib/utils';

type ExpandToggleProps = {
  expansion: Expansion;
  children: ReactNode;
};

export function ExpandToggle({ expansion, children }: ExpandToggleProps) {
  return expansion.expandable ? (
    <button
      type="button"
      data-clamp
      data-row-toggle
      aria-expanded={expansion.expanded}
      onClick={expansion.toggle}
      className="flex min-w-0 items-start gap-1 rounded-sm text-left font-medium text-foreground text-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
      >
        <ChevronRight
          className={cn(
            'size-3 transition-transform duration-200 motion-reduce:transition-none',
            expansion.expanded && 'rotate-90',
          )}
        />
      </span>
      <span className="min-w-0 break-words leading-4 group-data-clamped/row:line-clamp-1">
        {children}
      </span>
    </button>
  ) : (
    <span className="flex min-w-0 items-start gap-1 font-medium text-foreground text-xs">
      <span aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 truncate leading-4">{children}</span>
    </span>
  );
}
