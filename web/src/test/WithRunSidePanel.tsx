import type { ReactNode } from 'react';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { useRunSidePanel } from '@/lib/run-side-panel';

function Scrolled({ children }: { children: ReactNode }) {
  const { sidePanel } = useRunSidePanel();

  return <PaneScroller sidePanel={sidePanel}>{children}</PaneScroller>;
}

export function WithRunSidePanel({ children }: { children: ReactNode }) {
  return (
    <RunSidePanel>
      <Scrolled>{children}</Scrolled>
    </RunSidePanel>
  );
}
