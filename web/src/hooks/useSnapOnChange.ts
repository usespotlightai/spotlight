import { type RefObject, useLayoutEffect } from 'react';

export function useSnapOnChange(
  ref: RefObject<HTMLElement | null>,
  key: unknown,
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    element.style.transition = 'none';
    element.getBoundingClientRect();
    element.style.transition = '';
  }, [ref, key]);
}
