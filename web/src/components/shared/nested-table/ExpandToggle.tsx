import type { ReactNode } from 'react';
import type { Expansion } from '@/components/shared/nested-table/ExpandingRow';

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
      className="min-w-0 break-words rounded-sm text-left font-medium text-foreground text-xs outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring/50 group-data-clamped/row:line-clamp-1"
    >
      {children}
    </button>
  ) : (
    <span className="min-w-0 truncate font-medium text-foreground text-xs">
      {children}
    </span>
  );
}
