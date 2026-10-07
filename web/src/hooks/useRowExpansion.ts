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

const PART = '[data-glide-part]';

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

export function useRowExpansion(startsOpen = false): RowExpansion {
  const row = useRef<HTMLLIElement>(null);
  const pending = useRef<Pending | null>(null);
  const [expanded, setExpanded] = useState(startsOpen);
  const [clamped, setClamped] = useState(!startsOpen);
  const glide = useGlide();

  useLayoutEffect(() => {
    const element = row.current;
    const glided = pending.current;
    pending.current = null;

    if (element && glided && !clamped) {
      const now = placedWithCells(element);
      const spots = partSpots(element);

      glide.play([
        ...glideBetween(now, glided.from, now),
        ...shiftBetween(spots, glided.spots, spots),
      ]);
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
    const spots = partSpots(element);
    glide.play(
      [
        ...glideBetween(open, open, measuredAs(element, true, placedWithCells)),
        ...shiftBetween(spots, spots, measuredAs(element, true, partSpots)),
      ],
      clamp,
    );
  };

  const expand = (element: HTMLLIElement | null) => {
    setExpanded(true);

    if (glide.reverse()) {
      return;
    }

    if (canGlide(element)) {
      pending.current = {
        from: placedWithCells(element),
        spots: partSpots(element),
      };
    }
    setClamped(false);
  };

  const toggle = () => (expanded ? collapse : expand)(row.current);

  return { row, expanded, clamped, toggle };
}
