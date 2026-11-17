import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type InferenceProblemProps = {
  slot: string;
  alert?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function InferenceProblem({
  slot,
  alert = false,
  action,
  className,
  children,
}: InferenceProblemProps) {
  return (
    <div
      data-slot={slot}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm',
        alert ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <p role={alert ? 'alert' : undefined}>{children}</p>
      {action}
    </div>
  );
}
