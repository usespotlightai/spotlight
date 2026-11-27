import { useCallback, useEffect, useRef } from 'react';

export function useTimeout(): (run: () => void, ms: number) => void {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback((run: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  }, []);
}
