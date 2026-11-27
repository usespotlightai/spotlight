import { type ReactNode, useRef, type ReactElement } from 'react';

import { THREAD_GUTTER } from '@/components/shared/thread-column';
import { useTextBarTop } from '@/hooks/useTextBarTop';
import { cn } from '@/lib/utils';

export function ComposerFooter({
  floating = false,
  children,
}: {
  floating?: boolean;
  children: ReactNode;
}): ReactElement {
  const footer = useRef<HTMLDivElement>(null);
  const textBarTop = useTextBarTop(footer, floating);

  return (
    <div
      ref={footer}
      className={cn('relative shrink-0', !floating && 'bg-surface')}
    >
      {floating ? (
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 bg-surface"
          style={{ top: textBarTop }}
        />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute right-(--scrollbar-size) bottom-full left-0 h-10 bg-gradient-to-t from-surface to-transparent"
        />
      )}

      <div className={cn('mx-auto w-full max-w-3xl pt-2 pb-1', THREAD_GUTTER)}>
        <div className="-mx-3">{children}</div>
      </div>
    </div>
  );
}
