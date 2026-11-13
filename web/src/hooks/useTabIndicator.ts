import { type RefObject, useLayoutEffect, useState } from 'react';

export type TabIndicator = {
  readonly left: number;
  readonly width: number;
  readonly ready: boolean;
};

export function useTabIndicator(
  nav: RefObject<HTMLElement | null>,
  current: string,
): TabIndicator | null {
  const [indicator, setIndicator] = useState<TabIndicator | null>(null);

  useLayoutEffect(() => {
    const element = nav.current;

    if (!element) {
      return;
    }

    const measure = () => {
      const tab = element.querySelector<HTMLElement>(
        `[data-tab="${CSS.escape(current)}"]`,
      );

      const marked = tab?.querySelector<HTMLElement>('[data-tab-label]') ?? tab;

      setIndicator((was) => {
        if (!marked) {
          return null;
        }

        const left = marked.offsetLeft;
        const width = marked.offsetWidth;
        const ready = was !== null;

        return was?.left === left && was.width === width && was.ready === ready
          ? was
          : { left, width, ready };
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const tab of element.querySelectorAll('[data-tab]')) {
      observer.observe(tab);
    }

    return () => observer.disconnect();
  }, [nav, current]);

  return indicator;
}
