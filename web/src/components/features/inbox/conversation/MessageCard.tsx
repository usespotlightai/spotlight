import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function MessageCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-xs',
        className,
      )}
    >
      {children}
    </div>
  );
}
