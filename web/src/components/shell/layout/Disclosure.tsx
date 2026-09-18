import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DisclosureProps = {
  open: boolean;
  slot?: string;
  className?: string;
  children: ReactNode;
};

export function Disclosure({
  open,
  slot,
  className,
  children,
}: DisclosureProps) {
  return (
    <div
      data-slot={slot}
      data-open={open || undefined}
      className={cn(
        'grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <ul
        inert={!open}
        className={cn(
          'flex min-h-0 flex-col gap-0.5 overflow-hidden pt-0.5',
          className,
        )}
      >
        {children}
      </ul>
    </div>
  );
}
