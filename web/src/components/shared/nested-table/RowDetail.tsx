import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type RowDetailProps = {
  className?: string;
  children: ReactNode;
};

export function RowDetail({ className, children }: RowDetailProps) {
  return (
    <div
      data-slot="row-detail"
      className={cn(
        'hidden min-w-0 pb-1 @4xl:group-data-expanded/row:block @lg:group-data-compact/nested:group-data-expanded/row:block',
        className,
      )}
    >
      {children}
    </div>
  );
}
