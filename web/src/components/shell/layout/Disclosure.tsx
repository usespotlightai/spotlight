import { type ReactNode, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

const SHORTEST_MS = 180;
export const DISCLOSURE_MS = 400;
const MS_PER_PIXEL = 0.4;
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

type DisclosureProps = {
  open: boolean;
  slot?: string;
  label?: string;
  className?: string;
  children: ReactNode;
};

export function Disclosure({
  open,
  slot,
  label,
  className,
  children,
}: DisclosureProps) {
  const panel = useRef<HTMLDivElement>(null);
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
      [{ height: `${from}px` }, { height: `${to}px` }],
      {
        duration: Math.min(
          DISCLOSURE_MS,
          SHORTEST_MS + distance * MS_PER_PIXEL,
        ),
        easing: EASING,
      },
    );
  }, [open]);

  return (
    <div
      ref={panel}
      data-slot={slot}
      data-open={open || undefined}
      className={cn('overflow-hidden', !open && 'h-0')}
    >
      <ul
        aria-label={label}
        inert={!open}
        className={cn(
          'flex flex-col gap-0.5 pt-0.5 transition-opacity motion-reduce:transition-none',
          open ? 'duration-300 ease-out' : 'opacity-0 duration-150 ease-in',
          className,
        )}
      >
        {children}
      </ul>
    </div>
  );
}

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

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
