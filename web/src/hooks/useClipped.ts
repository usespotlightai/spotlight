import { type RefObject, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// Whether the element hides its overflow now. Starts true, so a clipped cell
// never renders the content it hides; an unclipped one corrects before paint.
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
    const observer = new ResizeObserver(() => {
      const next = read();
      flushSync(() => setClipped(next));
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, watching]);

  return watching && clipped;
}
