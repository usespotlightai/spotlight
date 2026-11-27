import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { transitionMove } from '@/lib/transition';

const NEED = '[data-need]';

type Moving = {
  readonly need: string;
  readonly from: DOMRect;
};

type NeedMoveResult = {
  open: boolean;
  transitioning: boolean;
  toggle: () => void;
};

export function useNeedMove(
  head: RefObject<HTMLElement | null>,
  body: RefObject<HTMLElement | null>,
): NeedMoveResult {
  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const moving = useRef<Moving | null>(null);
  const stopTransition = useRef<(() => void) | null>(null);

  const toggle = () => {
    const shown = (open ? body : head).current?.querySelector<HTMLElement>(
      NEED,
    );
    moving.current =
      shown?.dataset.need !== undefined && shown.dataset.need !== ''
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

    const firstShown = body.current?.firstElementChild;

    stopTransition.current?.();
    stopTransition.current =
      move && target
        ? transitionMove(
            move.from,
            target,
            firstShown instanceof HTMLElement ? firstShown : null,
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
