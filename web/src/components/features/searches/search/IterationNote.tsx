import type { ReactNode } from 'react';
import { ROW_DIVIDER } from '@/components/shared/nested-table/nested-rows';
import { cn } from '@/lib/utils';

export function IterationNote({ children }: { children: ReactNode }) {
  return (
    <li
      data-slot="iteration-note"
      className={cn(
        ROW_DIVIDER,
        'col-span-full flex flex-wrap items-baseline gap-x-1.5 py-3 pl-2 text-muted-foreground text-xs',
      )}
    >
      {children}
    </li>
  );
}
