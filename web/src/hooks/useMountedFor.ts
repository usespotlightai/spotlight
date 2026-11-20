import { useEffect, useState } from 'react';

// True once the component has been on screen for ms.
export function useMountedFor(ms: number): boolean {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);

  return done;
}
