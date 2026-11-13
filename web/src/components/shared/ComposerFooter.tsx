import type { ReactNode } from 'react';

import { THREAD_GUTTER } from '@/components/shared/thread-column';
import { cn } from '@/lib/utils';

export function ComposerFooter({ children }: { children: ReactNode }) {
  return (
    <div className="relative shrink-0 bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute right-(--scrollbar-size) bottom-full left-0 h-10 bg-gradient-to-t from-surface to-transparent"
      />

      <div className={cn('mx-auto w-full max-w-3xl pt-2 pb-1', THREAD_GUTTER)}>
        <div className="-mx-3">{children}</div>
      </div>
    </div>
  );
}
