import type { ReactNode } from 'react';

type SliceRowProps = {
  fill: string;
  values: ReactNode;
  slot: string;
  title?: string;
  children: ReactNode;
};

export function SliceRow({
  fill,
  values,
  slot,
  title,
  children,
}: SliceRowProps) {
  return (
    <li data-slot={slot} className="flex items-start gap-2 text-xs">
      <span
        aria-hidden
        className="mt-1 size-2 shrink-0 rounded-sm"
        style={{ background: fill }}
      />
      <span
        className="line-clamp-2 min-w-0 flex-1 text-foreground"
        title={title ?? (typeof children === 'string' ? children : undefined)}
      >
        {children}
      </span>
      {values}
    </li>
  );
}
