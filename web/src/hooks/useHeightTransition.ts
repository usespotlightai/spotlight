import { type RefObject, useLayoutEffect, useRef } from 'react';

import { DISCLOSURE_MS, prefersReducedMotion } from '@/lib/motion';

const SHORTEST_MS = 180;
const MS_PER_PIXEL = 0.4;
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

function visibleOpenHeight(element: HTMLElement) {
  element.style.height = 'auto';
  const { top, height } = element.getBoundingClientRect();
  element.style.height = '';
  return Math.max(0, Math.min(height, viewportBottom(element) - top));
}

function viewportBottom(element: HTMLElement) {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll')
      return parent.getBoundingClientRect().bottom;
  }
  return window.innerHeight;
}

export function useHeightTransition(
  panel: RefObject<HTMLElement | null>,
  open: boolean,
) {
  const wasOpen = useRef(open);
  const motion = useRef<Animation>(undefined);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element || wasOpen.current === open) return;
    wasOpen.current = open;
    if (typeof element.animate !== 'function' || prefersReducedMotion()) return;

    const moving = motion.current?.playState === 'running';
    const current = element.getBoundingClientRect().height;
    motion.current?.cancel();
    const shown = visibleOpenHeight(element);
    const from = moving ? current : open ? 0 : shown;
    const to = open ? shown : 0;
    const distance = Math.abs(to - from);
    if (distance < 1) return;

    motion.current = element.animate(
      // react-doctor-disable-next-line react-doctor/no-layout-property-animation
      [{ height: `${from}px` }, { height: `${to}px` }],
      {
        duration: Math.min(
          DISCLOSURE_MS,
          SHORTEST_MS + distance * MS_PER_PIXEL,
        ),
        easing: EASING,
      },
    );
  }, [panel, open]);
}
