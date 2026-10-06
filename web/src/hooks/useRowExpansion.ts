import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useGlide } from '@/hooks/useGlide';
import { glideBetween, type Placement, placementOf } from '@/lib/flip';
import { canGlide } from '@/lib/glide';

const CLAMPED = 'data-clamped';

type RowExpansion = {
  readonly row: RefObject<HTMLLIElement | null>;
  readonly expanded: boolean;
  readonly clamped: boolean;
  readonly toggle: () => void;
};

type Pending = { readonly from: Placement; readonly to: Placement };

const placedWithCells = (row: HTMLElement): Placement =>
  placementOf(
    row,
    [...row.children].filter((each) => each instanceof HTMLElement),
  );

const placedAs = (row: HTMLElement, clamped: boolean): Placement => {
  const was = row.hasAttribute(CLAMPED);
  row.toggleAttribute(CLAMPED, clamped);
  const placed = placedWithCells(row);
  row.toggleAttribute(CLAMPED, was);

  return placed;
};

export function useRowExpansion(): RowExpansion {
  const row = useRef<HTMLLIElement>(null);
  const pending = useRef<Pending | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(true);
  const glide = useGlide();

  useLayoutEffect(() => {
    const element = row.current;
    const glided = pending.current;
    pending.current = null;

    if (element && glided && !clamped) {
      glide.play(
        glideBetween(placedWithCells(element), glided.from, glided.to),
      );
    }
  }, [clamped, glide]);

  const clamp = () => setClamped(true);

  const collapse = (element: HTMLLIElement | null) => {
    setExpanded(false);

    if (glide.reverse(clamp)) {
      return;
    }

    if (!canGlide(element)) {
      clamp();
      return;
    }

    const open = placedWithCells(element);
    glide.play(glideBetween(open, open, placedAs(element, true)), clamp);
  };

  const expand = (element: HTMLLIElement | null) => {
    setExpanded(true);

    if (glide.reverse()) {
      return;
    }

    if (canGlide(element)) {
      pending.current = {
        from: placedWithCells(element),
        to: placedAs(element, false),
      };
    }
    setClamped(false);
  };

  const toggle = () => (expanded ? collapse : expand)(row.current);

  return { row, expanded, clamped, toggle };
}
