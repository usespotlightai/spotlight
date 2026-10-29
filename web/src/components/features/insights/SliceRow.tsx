import type { ReactNode } from 'react';

type SliceRowProps = {
  fill: string;
  values: ReactNode;
  slot: string;
  children: ReactNode;
};

export function SliceRow({ fill, values, slot, children }: SliceRowProps) {
  return (
    <li data-slot={slot} className="flex items-center gap-2 text-xs">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-sm"
        style={{ background: fill }}
      />
      <span className="min-w-0 flex-1 truncate text-foreground">
        {children}
      </span>
      {values}
    </li>
  );
}
