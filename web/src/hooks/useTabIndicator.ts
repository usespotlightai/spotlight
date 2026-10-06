import { type RefObject, useLayoutEffect, useState } from 'react';

export type TabIndicator = {
  readonly left: number;
  readonly width: number;
  readonly settled: boolean;
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

      setIndicator((was) =>
        marked
          ? {
              left: marked.offsetLeft,
              width: marked.offsetWidth,
              settled: was !== null,
            }
          : null,
      );
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
