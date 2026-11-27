import { useState } from 'react';

import { useStoredState } from '@/hooks/useStoredState';
import type { DecisionTray, DockedDecision } from '@/lib/decision-tray';

export function useDecisionTray(
  conversation: string,
  decisions: readonly DockedDecision[],
): DecisionTray {
  const [known, setKnown] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, storeCollapsed] = useStoredState(
    `spotlight.decision-tray-collapsed.${conversation}`,
    'false',
  );
  const open = collapsed !== 'true';
  const [at, setAt] = useState<string | null>(null);
  const [cover, setCover] = useState(0);
  const ids = new Set(decisions.map((decision) => decision.id));
  const fresh = decisions.find((decision) => !known.has(decision.id));
  const left = [...known].some((id) => !ids.has(id));

  if (fresh || left) {
    setKnown(ids);
  }

  if (fresh) {
    setAt(fresh.id);
  }

  const shown =
    decisions.find((decision) => decision.id === at) ?? decisions.at(0) ?? null;
  const place = shown ? decisions.indexOf(shown) : -1;

  return {
    decisions,
    shown,
    open,
    cover,
    measure: setCover,
    show: (id) => {
      setAt(id);
      storeCollapsed('false');
    },
    collapse: () => storeCollapsed('true'),
    step: (by) => {
      const next = decisions.at(place + by);

      if (next && place + by >= 0) {
        setAt(next.id);
      }
    },
  };
}
