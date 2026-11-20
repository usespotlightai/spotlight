import type { ReactNode } from 'react';

import type { Expansion } from '@/hooks/useExpandingRow';
import { cn } from '@/lib/utils';

type RowDetailProps = {
  expansion: Expansion;
  className?: string;
  children: ReactNode;
};

// A clamped row hides its detail, so the detail renders only when the row opens.
export function RowDetail({ expansion, className, children }: RowDetailProps) {
  return (
    <div
      data-slot="row-detail"
      className={cn(
        'hidden min-w-0 pb-1 @4xl:group-data-expanded/row:block @lg:group-data-compact/nested:group-data-expanded/row:block',
        className,
      )}
    >
      {!expansion.clamped && children}
    </div>
  );
}
