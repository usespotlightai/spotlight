import { type RefObject, useLayoutEffect, useState } from 'react';

export function useElementWidth(element: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const target = element.current;

    if (!target) {
      return;
    }

    // react-doctor-disable-next-line react-hooks-js/set-state-in-effect
    setWidth(Math.round(target.clientWidth));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    observer.observe(target);

    return () => observer.disconnect();
  }, [element]);

  return width;
}
