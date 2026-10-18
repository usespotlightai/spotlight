import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const COLLAPSE_MS = 200;

type CollapsibleProps = {
  open: boolean;
  appear: boolean;
  className?: string;
  children: ReactNode;
};

export function Collapsible({
  open,
  appear,
  className,
  children,
}: CollapsibleProps) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out-quad motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        open && appear && 'starting:grid-rows-[0fr] starting:opacity-0',
      )}
    >
      <div inert={!open} className={cn('min-h-0 overflow-hidden', className)}>
        {children}
      </div>
    </div>
  );
}
