import { type RefObject, useLayoutEffect, useState } from 'react';

export function useOverflows(
  ref: RefObject<HTMLElement | null>,
  watching: boolean,
  axis: 'x' | 'y' = 'y',
): boolean {
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element || !watching) {
      return;
    }

    const measure = () =>
      setOverflows(
        axis === 'x'
          ? element.scrollWidth > element.clientWidth + 1
          : element.scrollHeight > element.clientHeight + 1,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, watching, axis]);

  return overflows;
}
