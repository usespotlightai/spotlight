import { type RefObject, useLayoutEffect, useState } from 'react';

export function useOverflows(
  ref: RefObject<HTMLElement | null>,
  watching: boolean,
  axis: 'x' | 'y' = 'y',
  content?: unknown,
): boolean {
  const [overflows, setOverflows] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the measurement must follow the content, but the effect reads only the node
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
  }, [ref, watching, axis, content]);

  return overflows;
}
