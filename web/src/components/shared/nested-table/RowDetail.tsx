import type { ReactNode, ReactElement } from 'react';

import type { Expansion } from '@/hooks/useExpandingRow';
import { cn } from '@/lib/utils';

type RowDetailProps = {
  expansion: Expansion;
  className?: string;
  children: ReactNode;
};

export function RowDetail({
  expansion,
  className,
  children,
}: RowDetailProps): ReactElement {
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
