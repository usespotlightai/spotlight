import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { useOverflows } from '@/hooks/useOverflows';
import { canAnimate, ROW_SETTLED, ROW_TRANSITION } from '@/lib/motion';

export type Expansion = {
  readonly expanded: boolean;
  readonly clamped: boolean;
  readonly expandable: boolean;
  readonly toggle: () => void;
  readonly clamp: RefObject<HTMLDivElement | null>;
};

const pending = new WeakMap<HTMLElement, () => void>();

const release = (row: HTMLElement) => {
  pending.get(row)?.();
  pending.delete(row);
  row.style.transition = '';
  row.style.height = '';
  row.style.overflow = '';
};

const settle = (row: HTMLElement): number => {
  const height = row.getBoundingClientRect().height;

  release(row);

  return height;
};

const resize = (row: HTMLElement, from: number, to: number): Promise<void> =>
  new Promise((done) => {
    row.style.overflow = 'hidden';
    row.style.height = `${from}px`;
    row.getBoundingClientRect();
    row.style.transition = ROW_TRANSITION;
    row.style.height = `${to}px`;

    const finish = () => {
      release(row);
      done();
    };
    const ended = (event: TransitionEvent) => {
      if (event.target === row && event.propertyName === 'height') {
        finish();
      }
    };
    const timer = window.setTimeout(finish, ROW_SETTLED);

    row.addEventListener('transitionend', ended);
    pending.set(row, () => {
      window.clearTimeout(timer);
      row.removeEventListener('transitionend', ended);
    });
  });

type ExpandingRowResult = {
  row: RefObject<HTMLLIElement | null>;
  expansion: {
    expanded: boolean;
    clamped: boolean;
    expandable: boolean;
    toggle: () => void;
    clamp: RefObject<HTMLDivElement | null>;
  };
};

export function useExpandingRow(): ExpandingRowResult {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(true);
  const row = useRef<HTMLLIElement>(null);
  const opened = useRef<number | null>(null);
  const clamp = useRef<HTMLDivElement>(null);
  const expandable = useOverflows(clamp, clamped) || !clamped;

  useLayoutEffect(() => {
    const element = row.current;
    const from = opened.current;
    opened.current = null;

    if (!clamped && from !== null && canAnimate(element)) {
      void resize(element, from, element.offsetHeight);
    }
  }, [clamped]);

  const open = () => {
    const element = row.current;
    setExpanded(true);

    if (!canAnimate(element)) {
      setClamped(false);
      return;
    }

    const from = settle(element);

    if (clamped) {
      opened.current = from;
      setClamped(false);
      return;
    }

    void resize(element, from, element.offsetHeight);
  };

  const close = () => {
    const element = row.current;
    setExpanded(false);

    if (!canAnimate(element)) {
      setClamped(true);
      return;
    }

    const from = settle(element);
    element.dataset.clamped = '';
    const to = element.offsetHeight;
    delete element.dataset.clamped;

    void resize(element, from, to).then(() => {
      element.dataset.clamped = '';
      setClamped(true);
    });
  };

  const toggle = () => (expanded ? close() : open());

  return {
    row,
    expansion: { expanded, clamped, expandable, toggle, clamp },
  };
}
