import type { ReactNode } from 'react';

type BarRowProps = {
  share: number;
  values: ReactNode;
  slot?: string;
  children: ReactNode;
};

export function BarRow({ share, values, slot, children }: BarRowProps) {
  return (
    <li data-slot={slot} className="flex flex-col gap-0.5 text-xs">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-foreground">
          {children}
        </span>
        {values}
      </div>
      <span aria-hidden className="h-1 rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-chart-primary"
          style={{ width: `${Math.round(Math.min(share, 1) * 100)}%` }}
        />
      </span>
    </li>
  );
}
