import type { ReactNode } from 'react';
import { useFolding } from '@/hooks/useFolding';

type FoldingRowsProps = {
  open: boolean;
  label?: string;
  children: ReactNode;
};

export function FoldingRows({ open, label, children }: FoldingRowsProps) {
  const { rows, shown } = useFolding(open);

  if (!shown) {
    return null;
  }

  return (
    <li ref={rows} className="col-span-full grid grid-cols-subgrid">
      <ul
        aria-label={label}
        inert={!open}
        className="col-span-full grid grid-cols-subgrid"
      >
        {children}
      </ul>
    </li>
  );
}
