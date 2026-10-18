import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useLayoutTransition } from '@/hooks/useLayoutTransition';
import {
  layoutTransitionBetween,
  placementOf,
  placementWithout,
} from '@/lib/layout-transition';
import { canAnimate } from '@/lib/motion';

type CollapsibleState = {
  readonly rows: RefObject<HTMLLIElement | null>;
  readonly shown: boolean;
};

export function useCollapsible(open: boolean): CollapsibleState {
  const rows = useRef<HTMLLIElement>(null);
  const was = useRef(open);
  const [shown, setShown] = useState(open);
  const transition = useLayoutTransition();

  if (open && !shown) {
    setShown(true);
  }

  useLayoutEffect(() => {
    if (open === was.current) {
      return;
    }
    was.current = open;
    const element = rows.current;
    const done = open ? undefined : () => setShown(false);

    if (transition.reverse(done)) {
      return;
    }

    if (!canAnimate(element)) {
      done?.();
      return;
    }

    const expanded = placementOf(element);
    const collapsed = placementWithout(element);

    transition.play(
      open
        ? layoutTransitionBetween(expanded, collapsed, expanded)
        : layoutTransitionBetween(expanded, expanded, collapsed),
      done,
    );
  }, [open, transition]);

  return { rows, shown };
}
