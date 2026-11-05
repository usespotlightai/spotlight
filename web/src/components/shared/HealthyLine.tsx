import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function HealthyLine({
  title = 'All signals are healthy',
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="signals-healthy"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm"
    >
      <span className="flex min-w-0 items-center gap-2">
        <CircleCheck
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="text-foreground">{title}</span>
        <span className="text-muted-foreground">{children}</span>
      </span>
      {action}
    </div>
  );
}
