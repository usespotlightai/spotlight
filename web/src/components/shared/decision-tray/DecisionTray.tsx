import type { ReactNode } from 'react';

import { DecisionPill } from '@/components/shared/decision-tray/DecisionPill';
import { DecisionTrayCard } from '@/components/shared/decision-tray/DecisionTrayCard';
import { useTrayMotion } from '@/hooks/useTrayMotion';
import {
  decisionGroups,
  pillLabel,
  type DecisionTray as Tray,
} from '@/lib/decision-tray';
import { cn } from '@/lib/utils';

type DecisionTrayProps = {
  tray: Tray;
  children?: ReactNode;
};

export function DecisionTray({ tray, children }: DecisionTrayProps) {
  const { shown, open } = tray;
  const { card, pills, collapse } = useTrayMotion(
    open,
    tray.collapse,
    tray.measure,
  );

  return (
    <div data-decision className="flex flex-col gap-0.5">
      {shown && (
        <div className="relative">
          <div
            ref={pills}
            role="group"
            aria-label="Waiting for you"
            aria-hidden={open || undefined}
            inert={open}
            className={cn(
              'flex w-fit max-w-full flex-wrap items-center gap-1',
              open && 'invisible',
            )}
          >
            {decisionGroups(tray.decisions).map((group) => (
              <DecisionPill
                key={group[0].group}
                label={pillLabel(group)}
                current={group.includes(shown)}
                onShow={() =>
                  tray.show(group.includes(shown) ? shown.id : group[0].id)
                }
              />
            ))}
          </div>

          <DecisionTrayCard ref={card} tray={tray} onCollapse={collapse} />
        </div>
      )}

      {children}
    </div>
  );
}
