import { Children, type ReactNode } from 'react';
import { tilesInARow } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTiles({
  label,
  topAligned = false,
  className,
  children,
}: {
  label: string;
  topAligned?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const count = Children.toArray(children).length;

  return (
    <dl
      aria-label={label}
      data-top-aligned={topAligned || undefined}
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
