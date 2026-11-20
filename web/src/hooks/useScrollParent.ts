import { useCallback, useState } from 'react';

const scrollerOf = (element: HTMLElement | null): HTMLElement | null => {
  for (let at = element?.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);

    if (overflowY === 'auto' || overflowY === 'scroll') {
      return at;
    }
  }

  return null;
};

export function useScrollParent() {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);

  const attach = useCallback((element: HTMLElement | null) => {
    const found = scrollerOf(element);
    setScroller(found);

    if (element && found) {
      setMargin(
        element.getBoundingClientRect().top -
          found.getBoundingClientRect().top +
          found.scrollTop,
      );
    }
  }, []);

  return { attach, scroller, margin };
}
