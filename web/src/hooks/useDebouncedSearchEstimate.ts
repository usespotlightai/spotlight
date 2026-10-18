import { useMemo } from 'react';
import { useSearchEstimate } from '@/hooks/api/useSearchEstimate';
import { useDebounced } from '@/hooks/useDebounced';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchBudget } from '@/lib/search';
import { estimateInputOf, estimateKey } from '@/lib/search-start';

const ESTIMATE_MS = 400;

export function useDebouncedSearchEstimate(
  at: ReplayedStation,
  open: boolean,
  setId: string,
  budget: SearchBudget | null,
) {
  const debouncedKey = useDebounced(estimateKey(setId, budget), ESTIMATE_MS);
  const debounced = useMemo(
    () => estimateInputOf(debouncedKey),
    [debouncedKey],
  );
  const estimate = useSearchEstimate(at, open ? debounced : null);

  return { debounced, estimate };
}
