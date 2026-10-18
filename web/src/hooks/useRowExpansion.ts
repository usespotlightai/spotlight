import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useLayoutTransition } from '@/hooks/useLayoutTransition';
import {
  layoutTransitionBetween,
  type Placement,
  placementOf,
  type Spots,
  shiftBetween,
  spotsOf,
} from '@/lib/layout-transition';
import { canAnimate } from '@/lib/motion';

const CLAMPED = 'data-clamped';

const PART = '[data-transition-part]';

type RowExpansion = {
  readonly row: RefObject<HTMLLIElement | null>;
  readonly expanded: boolean;
  readonly clamped: boolean;
  readonly toggle: () => void;
};

type Pending = { readonly from: Placement; readonly spots: Spots };

const placedWithCells = (row: HTMLElement): Placement =>
  placementOf(
    row,
    [...row.children].filter((each) => each instanceof HTMLElement),
  );

const partSpots = (row: HTMLElement): Spots =>
  spotsOf([...row.querySelectorAll<HTMLElement>(PART)]);

const measuredAs = <T>(
  row: HTMLElement,
  clamped: boolean,
  measure: (row: HTMLElement) => T,
): T => {
  const was = row.hasAttribute(CLAMPED);
  row.toggleAttribute(CLAMPED, clamped);
  const measured = measure(row);
  row.toggleAttribute(CLAMPED, was);

  return measured;
};

type LayoutTransition = ReturnType<typeof useLayoutTransition>;

type RowControl = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

const collapse = (
  element: HTMLLIElement | null,
  transition: LayoutTransition,
  clamp: () => void,
) => {
  if (transition.reverse(clamp)) {
    return;
  }

  if (!canAnimate(element)) {
    clamp();
    return;
  }

  const open = placedWithCells(element);
  const spots = partSpots(element);
  transition.play(
    [
      ...layoutTransitionBetween(
        open,
        open,
        measuredAs(element, true, placedWithCells),
      ),
      ...shiftBetween(spots, spots, measuredAs(element, true, partSpots)),
    ],
    clamp,
  );
};

const expand = (
  element: HTMLLIElement | null,
  transition: LayoutTransition,
  pending: RefObject<Pending | null>,
  unclamp: () => void,
) => {
  if (transition.reverse()) {
    return;
  }

  if (canAnimate(element)) {
    pending.current = {
      from: placedWithCells(element),
      spots: partSpots(element),
    };
  }
  unclamp();
};

export function useRowExpansion(control?: RowControl): RowExpansion {
  const row = useRef<HTMLLIElement>(null);
  const pending = useRef<Pending | null>(null);
  const [own, setOwn] = useState(false);
  const expanded = control ? control.open : own;
  const [clamped, setClamped] = useState(!expanded);
  const shown = useRef(expanded);
  const transition = useLayoutTransition();

  useLayoutEffect(() => {
    if (shown.current === expanded) {
      return;
    }
    shown.current = expanded;

    if (expanded) {
      expand(row.current, transition, pending, () => setClamped(false));
    } else {
      collapse(row.current, transition, () => setClamped(true));
    }
  }, [expanded, transition]);

  useLayoutEffect(() => {
    const element = row.current;
    const moved = pending.current;
    pending.current = null;

    if (element && moved && !clamped) {
      const now = placedWithCells(element);
      const spots = partSpots(element);

      transition.play([
        ...layoutTransitionBetween(now, moved.from, now),
        ...shiftBetween(spots, moved.spots, spots),
      ]);
    }
  }, [clamped, transition]);

  const toggle = () =>
    control ? control.onOpenChange(!expanded) : setOwn(!expanded);

  return { row, expanded, clamped, toggle };
}
