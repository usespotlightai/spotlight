import { Children, type ReactNode } from 'react';
import { tilesInARow } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTiles({
  label,
  topAligned = false,
  stacked = false,
  className,
  children,
}: {
  label: string;
  topAligned?: boolean;
  stacked?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const count = Children.toArray(children).length;

  return (
    <dl
      aria-label={label}
      data-top-aligned={topAligned || undefined}
      data-stacked={stacked || undefined}
      className={cn(
        'group/tiles grid grid-cols-2 gap-2 sm:grid-cols-3',
        tilesInARow(count),
        className,
      )}
    >
      {children}
    </dl>
  );
}
