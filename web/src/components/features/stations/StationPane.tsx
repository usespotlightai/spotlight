import type { ReactNode } from 'react';
import { PaneScroller } from '@/components/shared/PaneScroller';

type StationPaneProps = {
  aside?: ReactNode;
  children: ReactNode;
};

export function StationPane({ aside, children }: StationPaneProps) {
  return (
    <PaneScroller aside={aside}>
      <main className="flex w-full flex-col gap-3 px-3 pt-3 pb-6">
        {children}
      </main>
    </PaneScroller>
  );
}
