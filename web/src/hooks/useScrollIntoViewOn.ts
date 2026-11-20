import { type RefObject, useEffect } from 'react';

export function useScrollIntoViewOn(
  element: RefObject<HTMLElement | null>,
  change: string,
) {
  useEffect(() => {
    if (change) {
      element.current?.scrollIntoView?.({ block: 'start' });
    }
  }, [element, change]);
}
