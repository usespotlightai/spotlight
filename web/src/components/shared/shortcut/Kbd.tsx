import type { ReactNode, ReactElement } from 'react';

import { cn } from '@/lib/utils';

type KbdProps = {
  plain?: boolean;
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function Kbd({
  plain = false,
  size = 'md',
  children,
}: KbdProps): ReactElement {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-sans text-[11px] text-muted-foreground leading-none',
        plain ? 'font-medium' : 'border-[0.5px] border-border px-1 font-normal',
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
