import type { ReactNode } from 'react';

type ReplayedFigureProps = {
  label: string;
  slot?: string;
  children: ReactNode;
};

export function ReplayedFigure({ label, slot, children }: ReplayedFigureProps) {
  return (
    <div data-slot={slot} className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-foreground tabular-nums">{children}</dd>
    </div>
  );
}
