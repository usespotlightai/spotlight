import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type NestedCellProps = {
  heading: string;
  strong?: boolean;
  numeric?: boolean;
  children: ReactNode;
};

export function NestedCell({
  heading,
  strong = false,
  numeric = true,
  children,
}: NestedCellProps) {
  return (
    <span
      className={cn(
        'flex min-w-0 flex-col pl-2 tabular-nums @4xl:block @4xl:pl-0 @lg:group-data-compact/nested:pl-0 @lg:group-data-compact/nested:block',
        numeric && '@4xl:text-right @lg:group-data-compact/nested:text-right',
        strong ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span className="font-normal text-muted-foreground text-xs @4xl:hidden @lg:group-data-compact/nested:hidden">
        {heading}
      </span>
      {children}
    </span>
  );
}
