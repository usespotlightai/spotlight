import { type ReactNode, useMemo, useState } from 'react';
import { BeforeAfterPanel } from '@/components/features/insights/changes/BeforeAfterPanel';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { useLingering } from '@/hooks/useLingering';
import { BeforeAfterPanelContext } from '@/lib/before-after-panel';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import type { ChangeAt } from '@/lib/insights-changes';

const LEAVING = 240;

type BeforeAfterHostProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
  children: ReactNode;
};

export function BeforeAfterHost({
  slug,
  teamId,
  period,
  names,
  children,
}: BeforeAfterHostProps) {
  const [shown, setShown] = useState<ChangeAt | null>(null);
  const held = useLingering(shown, LEAVING);

  const value = useMemo(
    () => ({
      shown,
      show: (change: ChangeAt) => setShown(change),
      close: () => setShown(null),
    }),
    [shown],
  );

  return (
    <BeforeAfterPanelContext value={value}>
      <PaneScroller
        aside={
          held && (
            <BeforeAfterPanel
              slug={slug}
              teamId={teamId}
              period={period}
              change={held}
              names={names}
              open={shown !== null}
              onClose={() => setShown(null)}
            />
          )
        }
      >
        {children}
      </PaneScroller>
    </BeforeAfterPanelContext>
  );
}
