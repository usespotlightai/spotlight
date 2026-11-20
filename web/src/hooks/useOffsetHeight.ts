import { type RefObject, useLayoutEffect, useState } from 'react';

export function useOffsetHeight(element: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measured = element.current;

    if (!measured) {
      return;
    }

    const observer = new ResizeObserver(() => setHeight(measured.offsetHeight));
    observer.observe(measured);
    return () => observer.disconnect();
  }, [element]);

  return height;
}
