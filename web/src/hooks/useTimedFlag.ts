import { useCallback, useEffect, useRef, useState } from 'react';

type TimedFlagResult = { on: boolean; raise: () => void };

export function useTimedFlag(ms: number): TimedFlagResult {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const raise = useCallback(() => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  return { on, raise };
}
