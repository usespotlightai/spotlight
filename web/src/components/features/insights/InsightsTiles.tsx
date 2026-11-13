import { Children, type ReactNode } from 'react';

import { tileGridOf } from '@/lib/insights-tiles';
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
      className={cn('group/tiles grid gap-3', tileGridOf(count), className)}
    >
      {children}
    </dl>
  );
}
