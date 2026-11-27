import { type RefObject, useLayoutEffect } from 'react';

import { canAnimate, TRANSITION_TIMING } from '@/lib/motion';

export function useSlidingLine(
  line: RefObject<HTMLElement | null>,
  left: number,
  width: number,
): void {
  useLayoutEffect(() => {
    const element = line.current;
    const strip = element?.offsetParent;

    if (!element || !(strip instanceof HTMLElement)) {
      return;
    }

    const shown = element.getBoundingClientRect();
    const box = strip.getBoundingClientRect();
    const fromLeft =
      shown.left - box.left - strip.clientLeft + strip.scrollLeft;
    const placed = element.style.width !== '';

    for (const running of element.getAnimations()) {
      running.cancel();
    }
    element.style.setProperty('left', `${left}px`);
    element.style.setProperty('width', `${width}px`);

    const moved =
      Math.abs(fromLeft - left) > 0.5 || Math.abs(shown.width - width) > 0.5;

    if (placed && moved && width > 0 && canAnimate(element)) {
      element.animate(
        [
          {
            transform: `translateX(${fromLeft - left}px) scaleX(${shown.width / width})`,
          },
          { transform: 'none' },
        ],
        TRANSITION_TIMING,
      );
    }
  }, [line, left, width]);
}
