import type { ReactNode, Ref } from 'react';

import { SKIPPED_OFF_SCREEN } from '@/lib/turns';
import { cn } from '@/lib/utils';

type TurnProps = {
  head: ReactNode;
  className?: string;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
};

export function Turn({ head, className, ref, children }: TurnProps) {
  return (
    <section
      ref={ref}
      className={cn(SKIPPED_OFF_SCREEN, 'flex flex-col', className)}
    >
      {head}
      {children}
    </section>
  );
}
