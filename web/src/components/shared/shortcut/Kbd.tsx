import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type KbdProps = {
  plain?: boolean;
  filled?: boolean;
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function Kbd({
  plain = false,
  filled = false,
  size = 'md',
  children,
}: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-sans text-[11px] text-muted-foreground leading-none',
        plain && 'font-medium',
        !plain && 'px-1 font-normal',
        !plain && (filled ? 'bg-muted' : 'border-[0.5px] border-border'),
        !plain &&
          (size === 'sm'
            ? 'h-4.5 min-w-4.5 rounded-[4px]'
            : 'h-5.25 min-w-5 rounded-[3px]'),
      )}
    >
      {children}
    </kbd>
  );
}
