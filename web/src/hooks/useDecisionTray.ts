import { useState } from 'react';

import type { DecisionTray, DockedDecision } from '@/lib/decision-tray';

export function useDecisionTray(
  decisions: readonly DockedDecision[],
): DecisionTray {
  const [known, setKnown] = useState<ReadonlySet<string>>(() => new Set());
  const [open, setOpen] = useState(true);
  const [at, setAt] = useState<string | null>(null);
  const [cover, setCover] = useState(0);
  const fresh = decisions.find((decision) => !known.has(decision.id));

  if (fresh) {
    setKnown(new Set([...known, ...decisions.map((decision) => decision.id)]));
    setOpen(true);
    setAt(fresh.id);
  }

  const shown =
    decisions.find((decision) => decision.id === at) ?? decisions[0] ?? null;
  const place = shown ? decisions.indexOf(shown) : -1;

  return {
    decisions,
    shown,
    open,
    cover,
    measure: setCover,
    show: (id) => {
      setAt(id);
      setOpen(true);
    },
    collapse: () => setOpen(false),
    step: (by) => {
      const next = decisions[place + by];

      if (next) {
        setAt(next.id);
      }
    },
  };
}
