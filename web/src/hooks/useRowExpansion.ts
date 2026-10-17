import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useGlide } from '@/hooks/useGlide';
import {
  glideBetween,
  type Placement,
  placementOf,
  type Spots,
  shiftBetween,
  spotsOf,
} from '@/lib/flip';
import { canGlide } from '@/lib/glide';

const CLAMPED = 'data-clamped';

const GLIDING = 'data-gliding';

const PART = '[data-glide-part]';

type RowExpansion = {
  readonly row: RefObject<HTMLLIElement | null>;
  readonly expanded: boolean;
  readonly clamped: boolean;
  readonly closing: boolean;
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

type Glide = ReturnType<typeof useGlide>;

const marked = (
  element: HTMLElement,
  animations: readonly Animation[],
): readonly Animation[] => {
  if (animations.length > 0) {
    element.setAttribute(GLIDING, '');
    void Promise.allSettled(
      animations.map((animation) => animation.finished),
    ).then(() => element.removeAttribute(GLIDING));
  }

  return animations;
};

type RowControl = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

const collapse = (
  element: HTMLLIElement | null,
  glide: Glide,
  clamp: () => void,
) => {
  if (glide.reverse(clamp)) {
    return;
  }

  if (!canGlide(element)) {
    clamp();
    return;
  }

  const open = placedWithCells(element);
  const spots = partSpots(element);
  glide.play(
    [
      ...glideBetween(open, open, measuredAs(element, true, placedWithCells)),
      ...shiftBetween(spots, spots, measuredAs(element, true, partSpots)),
    ],
    clamp,
  );
};

const expand = (
  element: HTMLLIElement | null,
  glide: Glide,
  pending: RefObject<Pending | null>,
  unclamp: () => void,
) => {
  if (glide.reverse()) {
    return;
  }

  if (canGlide(element)) {
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
  const glide = useGlide();

  useLayoutEffect(() => {
    if (shown.current === expanded) {
      return;
    }
    shown.current = expanded;

    if (expanded) {
      expand(row.current, glide, pending, () => setClamped(false));
    } else {
      collapse(row.current, glide, () => setClamped(true));
    }
  }, [expanded, glide]);

  useLayoutEffect(() => {
    const element = row.current;
    const glided = pending.current;
    pending.current = null;

    if (element && glided && !clamped) {
      const now = placedWithCells(element);
      const spots = partSpots(element);

      glide.play(
        marked(element, [
          ...glideBetween(now, glided.from, now),
          ...shiftBetween(spots, glided.spots, spots),
        ]),
      );
    }
  }, [clamped, glide]);

  const toggle = () =>
    control ? control.onOpenChange(!expanded) : setOwn(!expanded);

  return {
    row,
    expanded,
    clamped,
    closing: !expanded && !clamped,
    toggle,
  };
}
