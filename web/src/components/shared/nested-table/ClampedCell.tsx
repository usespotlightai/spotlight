import type { ReactNode } from 'react';
import type { Expansion } from '@/components/shared/nested-table/ExpandingRow';

type ClampedCellProps = {
  expansion: Expansion;
  children: ReactNode;
};

export function ClampedCell({ expansion, children }: ClampedCellProps) {
  return (
    <div
      ref={expansion.clamp}
      data-clamp
      className="col-span-full min-w-0 @4xl:col-span-1 @4xl:group-data-clamped/row:max-h-4 @4xl:group-data-clamped/row:overflow-hidden"
    >
      {children}
    </div>
  );
}
