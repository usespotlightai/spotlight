import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { transitionMove } from '@/lib/transition';

const NEED = '[data-need]';

type Moving = {
  readonly need: string;
  readonly from: DOMRect;
};

export function useNeedMove(
  head: RefObject<HTMLElement | null>,
  body: RefObject<HTMLElement | null>,
) {
  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const moving = useRef<Moving | null>(null);
  const stopTransition = useRef<(() => void) | null>(null);

  const toggle = () => {
    const shown = (open ? body : head).current?.querySelector<HTMLElement>(
      NEED,
    );
    moving.current = shown?.dataset.need
      ? { need: shown.dataset.need, from: shown.getBoundingClientRect() }
      : null;
    setOpen((was) => !was);
  };
  useLayoutEffect(() => {
    const move = moving.current;
    moving.current = null;
    const target = (open ? body : head).current?.querySelector<HTMLElement>(
      `[data-need="${move?.need}"]`,
    );

    stopTransition.current?.();
    stopTransition.current =
      move && target
        ? transitionMove(
            move.from,
            target,
            body.current?.firstElementChild as HTMLElement | null,
            (end) =>
              end === 'finished'
                ? flushSync(() => setTransitioning(false))
                : setTransitioning(false),
          )
        : null;

    setTransitioning(stopTransition.current !== null);
  }, [head, body, open]);

  return { open, transitioning, toggle };
}
