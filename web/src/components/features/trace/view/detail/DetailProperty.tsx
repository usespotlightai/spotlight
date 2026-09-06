import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DetailProperty({
  name,
  children,
  failed = false,
}: {
  name: string;
  children: ReactNode;
  failed?: boolean;
}) {
  return (
    <div className="-mx-2 flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-accent">
      <dt className="w-28 shrink-0 truncate text-muted-foreground text-xs">
        {name}
      </dt>
      <dd
        className={cn(
          'min-w-0 flex-1 truncate text-sm tabular-nums',
          failed ? 'text-destructive' : 'text-foreground',
        )}
      >
        {children}
      </dd>
    </div>
  );
}
