import type { ReactNode } from 'react';

import type { Expansion } from '@/components/shared/nested-table/ExpandingRow';

type ClampedCellProps = {
  expansion: Expansion;
  children: ReactNode;
};

export function ClampedCell({
  expansion: { clamp },
  children,
}: ClampedCellProps) {
  return (
    <div
      ref={clamp}
      data-clamp
      className="col-span-full min-w-0 pl-(--cell-indent,0.5rem) @4xl:col-span-1 @4xl:pl-0 @lg:group-data-compact/nested:pl-0 @lg:group-data-compact/nested:col-span-1 @4xl:group-data-clamped/row:max-h-4 @lg:group-data-compact/nested:group-data-clamped/row:max-h-4 @4xl:group-data-clamped/row:overflow-hidden @lg:group-data-compact/nested:group-data-clamped/row:overflow-hidden"
    >
      {children}
    </div>
  );
}
