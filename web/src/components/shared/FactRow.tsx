import type { ReactNode } from 'react';

export const FACT_LABEL = 'text-muted-foreground text-sm leading-6';

export const FACT_VALUE =
  'whitespace-pre-wrap break-words text-foreground text-sm leading-6';

export function FactRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 py-1 first:pt-0 last:pb-0">
      {children}
    </div>
  );
}
