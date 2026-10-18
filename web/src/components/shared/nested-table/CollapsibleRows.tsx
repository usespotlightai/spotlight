import type { ReactNode } from 'react';
import { useCollapsible } from '@/hooks/useCollapsible';

type CollapsibleRowsProps = {
  open: boolean;
  label?: string;
  children: ReactNode;
};

export function CollapsibleRows({
  open,
  label,
  children,
}: CollapsibleRowsProps) {
  const { rows, shown } = useCollapsible(open);

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
