import {
  type RefObject,
  startTransition,
  useLayoutEffect,
  useState,
} from 'react';

const SETTLE_MS = 100;

export function useElementWidth(element: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const target = element.current;

    if (!target) {
      return;
    }

    let shown = Math.round(target.clientWidth);
    let settling: number | undefined;
    const show = (next: number) => {
      shown = next;
      setWidth(next);
    };

    show(shown);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }
      const next = Math.round(entry.contentRect.width);
      window.clearTimeout(settling);
      if (next === shown) {
        return;
      }
      if (shown === 0) {
        show(next);
        return;
      }
      settling = window.setTimeout(
        () => startTransition(() => show(next)),
        SETTLE_MS,
      );
    });
    observer.observe(target);

    return () => {
      window.clearTimeout(settling);
      observer.disconnect();
    };
  }, [element]);

  return width;
}
