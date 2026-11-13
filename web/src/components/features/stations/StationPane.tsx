import type { ReactNode } from 'react';

import { STATION_COLUMN } from '@/components/features/stations/station-column';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { cn } from '@/lib/utils';

type StationPaneProps = {
  heading?: ReactNode;
  sidePanel?: ReactNode;
  children: ReactNode;
};

export function StationPane({
  heading,
  sidePanel,
  children,
}: StationPaneProps) {
  return (
    <PaneScroller sidePanel={sidePanel}>
      {heading}
      <main className={cn(STATION_COLUMN, 'flex flex-col gap-3 pt-3 pb-6')}>
        {children}
      </main>
    </PaneScroller>
  );
}
