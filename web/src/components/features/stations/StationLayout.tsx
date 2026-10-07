import type { ReactNode } from 'react';
import { PaneScroller } from '@/components/shared/PaneScroller';

type StationLayoutProps = {
  aside?: ReactNode;
  children: ReactNode;
};

export function StationLayout({ aside, children }: StationLayoutProps) {
  return (
    <PaneScroller aside={aside}>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-8">
        {children}
      </main>
    </PaneScroller>
  );
}
