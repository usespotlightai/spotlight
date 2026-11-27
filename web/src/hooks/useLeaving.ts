import { useEffect, useRef, useState } from 'react';

type LeavingResult = {
  leaving: ReadonlySet<string>;
  leave: (key: string) => void;
};

export function useLeaving(
  ms: number,
  onLeft: (key: string) => void,
): LeavingResult {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const leave = (key: string) => {
    if (timers.current.has(key)) {
      return;
    }

    setLeaving((was) => new Set(was).add(key));

    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        setLeaving((was) => {
          const next = new Set(was);
          next.delete(key);
          return next;
        });
        onLeft(key);
      }, ms),
    );
  };

  return { leaving, leave };
}
