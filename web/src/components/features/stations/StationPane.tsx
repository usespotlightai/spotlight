import type { ReactNode } from 'react';
import { PaneScroller } from '@/components/shared/PaneScroller';

export function StationPane({ children }: { children: ReactNode }) {
  return (
    <PaneScroller>
      <main className="flex w-full flex-col gap-3 px-3 pt-3 pb-6">
        {children}
      </main>
    </PaneScroller>
  );
}
