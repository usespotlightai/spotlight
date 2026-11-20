import type { ReactNode, Ref } from 'react';

import { SHOWN_FIRST, SKIPPED_OFF_SCREEN } from '@/lib/turns';
import { cn } from '@/lib/utils';

type TurnProps = {
  head: ReactNode;
  className?: string;
  shownFirst?: boolean;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
};

export function Turn({
  head,
  className,
  shownFirst = false,
  ref,
  children,
}: TurnProps) {
  return (
    <section
      ref={ref}
      className={cn(
        shownFirst ? SHOWN_FIRST : SKIPPED_OFF_SCREEN,
        'flex flex-col',
        className,
      )}
    >
      {head}
      {children}
    </section>
  );
}
