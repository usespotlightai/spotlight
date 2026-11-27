import { useVirtualizer } from '@pierre/diffs/react';
import { useEffect } from 'react';

export function useScrollToTopOn(change: string): void {
  const virtualizer = useVirtualizer();

  useEffect(() => {
    virtualizer?.scrollTo({ top: 0 });
  }, [virtualizer, change]);
}
