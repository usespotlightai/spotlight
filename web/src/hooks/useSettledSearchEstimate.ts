import { useMemo } from 'react';
import { useSearchEstimate } from '@/hooks/api/useSearchEstimate';
import { useDebounced } from '@/hooks/useDebounced';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchBudget } from '@/lib/search';
import { estimateAskedOf, estimateKey } from '@/lib/search-start';

const ESTIMATE_MS = 400;

export function useSettledSearchEstimate(
  at: ReplayedStation,
  open: boolean,
  setId: string,
  budget: SearchBudget | null,
) {
  const settledKey = useDebounced(estimateKey(setId, budget), ESTIMATE_MS);
  const settled = useMemo(() => estimateAskedOf(settledKey), [settledKey]);
  const estimate = useSearchEstimate(at, open ? settled : null);

  return { settled, estimate };
}
