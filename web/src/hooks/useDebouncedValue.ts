import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(current: T, ms: number): T {
  const [settled, setSettled] = useState(current);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(current), ms);
    return () => clearTimeout(timer);
  }, [current, ms]);

  return settled;
}
