import { type ReactNode, useMemo, useRef, useState } from 'react';

import { BeforeAfterPanel } from '@/components/features/insights/changes/BeforeAfterPanel';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { useDocumentListener } from '@/hooks/useDocumentListener';
import {
  BeforeAfterActionsContext,
  BeforeAfterShownContext,
  PANEL_SLOT,
} from '@/lib/before-after-panel';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import type { ChangeAt } from '@/lib/insights-changes';

const LEAVING = 240;

// Focus that would be lost when the panel closes: on the panel, or nowhere.
const lostOnClose = (): boolean => {
  const active = document.activeElement;
  return (
    !active ||
    active === document.body ||
    Boolean(active.closest(`[data-slot="${PANEL_SLOT}"]`))
  );
};

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
  const displayed = useDelayedValue(shown, LEAVING);
  const opener = useRef<HTMLElement | null>(null);

  const actions = useMemo(
    () => ({
      show: (change: ChangeAt) => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active !== document.body) {
          opener.current = active;
        }
        setShown(change);
      },
      close: () => {
        const back = opener.current;
        opener.current = null;
        if (back?.isConnected && lostOnClose()) {
          back.focus();
        }
        setShown(null);
      },
    }),
    [],
  );

  useDocumentListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        actions.close();
      }
    },
    shown !== null,
  );

  return (
    <BeforeAfterActionsContext value={actions}>
      <BeforeAfterShownContext value={shown}>
        <PaneScroller
          sidePanel={
            displayed && (
              <BeforeAfterPanel
                slug={slug}
                teamId={teamId}
                period={period}
                change={displayed}
                names={names}
                open={shown !== null}
                onClose={actions.close}
              />
            )
          }
        >
          {children}
        </PaneScroller>
      </BeforeAfterShownContext>
    </BeforeAfterActionsContext>
  );
}
