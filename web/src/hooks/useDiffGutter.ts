import { type RefObject, useEffect, useState } from 'react';

const GUTTER = 48;

const lineIn = (of: Element): Element | null =>
  of
    .querySelector('diffs-container')
    ?.shadowRoot?.querySelector('[data-line-type]') ?? null;

export function useDiffGutter(of: RefObject<Element | null>): number {
  const [gutter, setGutter] = useState(GUTTER);

  useEffect(() => {
    const element = of.current;

    if (!element) {
      return;
    }

    const sizing = new ResizeObserver(() => {
      const line = lineIn(element);

      if (line) {
        setGutter(Math.round(line.getBoundingClientRect().width));
      }
    });

    const watch = () => {
      const diff = element.querySelector('diffs-container');

      if (diff) {
        sizing.observe(diff);
      }

      return Boolean(diff);
    };

    if (watch()) {
      return () => sizing.disconnect();
    }

    const mounting = new MutationObserver(() => {
      if (watch()) {
        mounting.disconnect();
      }
    });

    mounting.observe(element, { childList: true, subtree: true });

    return () => {
      mounting.disconnect();
      sizing.disconnect();
    };
  }, [of]);

  return gutter;
}
