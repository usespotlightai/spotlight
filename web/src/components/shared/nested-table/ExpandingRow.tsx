import type { ReactNode } from 'react';

import { type Expansion, useExpandingRow } from '@/hooks/useExpandingRow';
import { cn } from '@/lib/utils';

type ExpandingRowProps = {
  slot: string;
  className?: string;
  children: (expansion: Expansion) => ReactNode;
};

export function ExpandingRow({ slot, className, children }: ExpandingRowProps) {
  const { row, expansion } = useExpandingRow();
  const { expanded, clamped, expandable } = expansion;

  return (
    <li
      ref={row}
      data-slot={slot}
      data-expanded={!clamped || undefined}
      data-clamped={clamped || undefined}
      className={cn(
        'group/row relative col-span-full grid grid-cols-2 items-baseline gap-x-6 gap-y-2 py-2 pr-2 text-sm @4xl:grid-cols-subgrid @lg:group-data-compact/nested:grid-cols-subgrid @4xl:overflow-hidden @lg:group-data-compact/nested:overflow-hidden @4xl:data-clamped:h-9 @lg:group-data-compact/nested:data-clamped:h-9 [&_a]:relative [&_a]:z-10 [&_button:not([data-row-toggle])]:relative [&_button:not([data-row-toggle])]:z-10',
        expandable && 'cursor-pointer hover:bg-muted/20 dark:hover:bg-muted',
        expanded && 'bg-muted/30',
        className,
      )}
    >
      {children(expansion)}
    </li>
  );
}
