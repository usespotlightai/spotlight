import { useEffect, useEffectEvent, useState } from 'react';

import { springMs } from '@/lib/motion';

export function useSettling<T>(onSettled: (value: T) => void = () => {}) {
  const [settling, setSettling] = useState<T | null>(null);
  const settled = useEffectEvent(onSettled);

  useEffect(() => {
    if (settling === null) {
      return;
    }

    const timer = setTimeout(() => {
      setSettling(null);
      settled(settling);
    }, springMs());
    return () => clearTimeout(timer);
  }, [settling]);

  return [settling, setSettling] as const;
}
