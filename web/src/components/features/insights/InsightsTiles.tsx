import { Children, type ReactNode } from 'react';
import { tilesInARow } from '@/lib/insights-tiles';
import { cn } from '@/lib/utils';

export function InsightsTiles({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const count = Children.toArray(children).length;

  return (
    <dl
      aria-label={label}
      className={cn(
        'grid grid-cols-2 gap-2 sm:grid-cols-3',
        tilesInARow(count),
        className,
      )}
    >
      {children}
    </dl>
  );
}
