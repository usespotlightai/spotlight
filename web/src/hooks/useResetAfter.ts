import { useEffect } from 'react';

export function useResetAfter(
  done: boolean,
  reset: () => void,
  ms: number,
): void {
  useEffect(() => {
    if (!done) {
      return;
    }

    const timer = setTimeout(reset, ms);
    return () => clearTimeout(timer);
  }, [done, reset, ms]);
}
