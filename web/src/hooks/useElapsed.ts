import { useEffect, useState } from 'react';

const TICK_MS = 1_000;

const startedOn = (key: string, since: number | null) => {
  const now = Date.now();
  const start =
    since === null || Number.isNaN(since) ? now : Math.min(since, now);
  return { key, start, now };
};

export function useElapsed(key: string, since: number | null = null): number {
  const [clock, setClock] = useState(() => startedOn(key, since));
  if (clock.key !== key) {
    setClock(startedOn(key, since));
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
