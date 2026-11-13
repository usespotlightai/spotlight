import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { springMs } from '@/lib/motion';

export function useSettling<T>(onSettled: (value: T) => void = () => {}) {
  const [settling, setSettling] = useState<{ value: T } | null>(null);
  const settled = useRef(onSettled);

  useLayoutEffect(() => {
    settled.current = onSettled;
  });

  useEffect(() => {
    if (settling === null) {
      return;
    }

    const timer = setTimeout(() => {
      setSettling(null);
      settled.current(settling.value);
    }, springMs());
    return () => clearTimeout(timer);
  }, [settling]);

  const settle = useCallback((value: T | null) => {
    if (value === null) {
      setSettling(null);
    } else if (springMs() === 0) {
      setSettling(null);
      settled.current(value);
    } else {
      setSettling({ value });
    }
  }, []);

  return [settling?.value ?? null, settle] as const;
}
