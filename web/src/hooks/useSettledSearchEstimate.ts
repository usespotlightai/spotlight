import { useMemo } from 'react';
import { useSearchEstimate } from '@/hooks/api/useSearchEstimate';
import { useDebounced } from '@/hooks/useDebounced';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchBudget } from '@/lib/search';

const ESTIMATE_MS = 400;

type EstimateAsked = { setId: string; budget: SearchBudget };

export function useSettledSearchEstimate(
  at: ReplayedStation,
  setId: string,
  budget: SearchBudget | null,
  open: boolean,
) {
  const askedKey = setId && budget ? JSON.stringify({ setId, budget }) : null;
  const settledKey = useDebounced(askedKey, ESTIMATE_MS);
  const settled = useMemo(
    () => (settledKey ? (JSON.parse(settledKey) as EstimateAsked) : null),
    [settledKey],
  );
  const estimate = useSearchEstimate(at, open ? settled : null);

  return { settled, estimate };
}
