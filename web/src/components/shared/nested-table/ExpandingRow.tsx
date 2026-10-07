import { type ReactNode, type RefObject, useRef } from 'react';
import { useOverflows } from '@/hooks/useOverflows';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import { cn } from '@/lib/utils';

export type Expansion = {
  readonly expanded: boolean;
  readonly clamped: boolean;
  readonly expandable: boolean;
  readonly toggle: () => void;
  readonly clamp: RefObject<HTMLDivElement | null>;
};

type ExpandingRowProps = {
  slot: string;
  className?: string;
  children: (expansion: Expansion) => ReactNode;
};

export function ExpandingRow({ slot, className, children }: ExpandingRowProps) {
  const { row, expanded, clamped, toggle } = useRowExpansion();
  const clamp = useRef<HTMLDivElement>(null);
  const expandable = useOverflows(clamp, clamped) || !clamped;

  return (
    <li
      ref={row}
      data-slot={slot}
      data-expanded={expanded || undefined}
      data-clamped={clamped || undefined}
      className={cn(
        'group/row relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-1 pr-2 transition-colors @4xl:grid-cols-subgrid @4xl:overflow-hidden @4xl:data-clamped:h-8 [&_a]:relative [&_a]:z-10 [&_button:not([data-row-toggle])]:relative [&_button:not([data-row-toggle])]:z-10',
        expandable && 'cursor-pointer hover:bg-muted/20',
        expanded && 'bg-muted/30',
        className,
      )}
    >
      {children({ expanded, clamped, expandable, toggle, clamp })}
    </li>
  );
}
