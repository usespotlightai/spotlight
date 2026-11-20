import { type RefObject, useLayoutEffect, useState } from 'react';

export function useClipped(
  ref: RefObject<HTMLElement | null>,
  watching: boolean,
): boolean {
  const [clipped, setClipped] = useState(watching);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element || !watching) {
      return;
    }

    const read = () => getComputedStyle(element).overflowY === 'hidden';
    setClipped(read());
    const observer = new ResizeObserver(() => setClipped(read()));
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, watching]);

  return watching && clipped;
}
