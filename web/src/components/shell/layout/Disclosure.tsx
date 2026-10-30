import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const DISCLOSURE_MS = 300;

type DisclosureProps = {
  open: boolean;
  slot?: string;
  label?: string;
  className?: string;
  children: ReactNode;
};

export function Disclosure({
  open,
  slot,
  label,
  className,
  children,
}: DisclosureProps) {
  return (
    <div
      data-slot={slot}
      data-open={open || undefined}
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <ul
        aria-label={label}
        inert={!open}
        className={cn(
          'flex min-h-0 flex-col gap-0.5 overflow-hidden pt-0.5 transition-opacity duration-200 ease-out motion-reduce:transition-none',
          !open && 'opacity-0',
          className,
        )}
      >
        {children}
      </ul>
    </div>
  );
}
