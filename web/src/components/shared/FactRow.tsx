import type { ReactNode, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export const FACT_LABEL = 'text-muted-foreground text-sm leading-6';

export const FACT_VALUE =
  'whitespace-pre-wrap break-words text-foreground text-sm leading-6';

type FactRowProps = {
  wide?: boolean;
  children: ReactNode;
};

export function FactRow({
  wide = false,
  children,
}: FactRowProps): ReactElement {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-x-4 py-1 first:pt-0 last:pb-0',
        wide
          ? '@md/pane:grid-cols-[8rem_minmax(0,1fr)]'
          : '@md/pane:grid-cols-[6rem_minmax(0,1fr)]',
      )}
    >
      {children}
    </div>
  );
}
