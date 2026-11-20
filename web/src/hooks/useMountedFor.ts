import { useEffect, useState } from 'react';

export function useMountedFor(ms: number): boolean {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);

  return done;
}
