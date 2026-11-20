import { type ReactNode, useRef } from 'react';

import { useHeightTransition } from '@/hooks/useHeightTransition';
import { cn } from '@/lib/utils';

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
  const panel = useRef<HTMLDivElement>(null);

  useHeightTransition(panel, open);

  return (
    <div
      ref={panel}
      data-slot={slot}
      data-open={open || undefined}
      className={cn('overflow-hidden', !open && 'h-0')}
    >
      <ul
        aria-label={label}
        inert={!open}
        className={cn(
          'flex flex-col gap-0.5 pt-0.5 transition-opacity motion-reduce:transition-none',
          open ? 'duration-300 ease-out' : 'opacity-0 duration-150 ease-in',
          className,
        )}
      >
        {children}
      </ul>
    </div>
  );
}
