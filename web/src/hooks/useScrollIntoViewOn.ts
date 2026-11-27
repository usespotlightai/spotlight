import { type RefObject, useEffect } from 'react';

export function useScrollIntoViewOn(
  element: RefObject<HTMLElement | null>,
  change: string,
): void {
  useEffect(() => {
    if (change) {
      element.current?.scrollIntoView({ block: 'start' });
    }
  }, [element, change]);
}
