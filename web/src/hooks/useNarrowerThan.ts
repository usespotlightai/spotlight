import { type RefObject, useLayoutEffect, useState } from 'react';

export function useNarrowerThan(
  element: RefObject<HTMLElement | null>,
  px: number,
) {
  const [narrower, setNarrower] = useState(false);

  useLayoutEffect(() => {
    const target = element.current;
    if (!target) {
      return;
    }

    let shown: boolean | undefined;
    const measure = (width: number) => {
      const next = width > 0 && width < px;
      if (next !== shown) {
        shown = next;
        setNarrower(next);
      }
    };
    measure(target.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        measure(entry.contentRect.width);
      }
    });
    observer.observe(target);

    return () => observer.disconnect();
  }, [element, px]);

  return narrower;
}
