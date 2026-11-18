import { useEffect, useState } from 'react';

const TICK_MS = 1_000;

const startedOn = (key: string) => {
  const start = Date.now();
  return { key, start, now: start };
};

export function useElapsed(key: string): number {
  const [clock, setClock] = useState(() => startedOn(key));
  if (clock.key !== key) {
    setClock(startedOn(key));
  }

  useEffect(() => {
    const timer = setInterval(
      () => setClock((was) => ({ ...was, now: Date.now() })),
      TICK_MS,
    );

    return () => clearInterval(timer);
  }, []);

  return clock.key === key ? clock.now - clock.start : 0;
}
