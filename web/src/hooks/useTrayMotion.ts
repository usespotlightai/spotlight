import { useLayoutEffect, useRef } from 'react';

import { canAnimate } from '@/lib/motion';

const MORPHING: KeyframeAnimationOptions = {
  duration: 240,
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  fill: 'both',
};

const boxes = (card: HTMLElement, pill: HTMLElement): Keyframe[] => {
  const from = card.getBoundingClientRect();
  const to = pill.getBoundingClientRect();
  const bottom = Number.parseFloat(getComputedStyle(card).bottom) || 0;

  return [
    {
      left: '0px',
      right: '0px',
      bottom: `${bottom}px`,
      height: `${from.height}px`,
      borderRadius: '16px',
    },
    {
      left: `${to.left - from.left}px`,
      right: `${from.right - to.right}px`,
      bottom: `${bottom + from.bottom - to.bottom}px`,
      height: `${to.height}px`,
      borderRadius: `${to.height / 2}px`,
    },
  ];
};

const hold = (card: HTMLElement) => {
  const parts = [...card.children].filter(
    (part): part is HTMLElement => part instanceof HTMLElement,
  );

  for (const part of parts) {
    part.style.width = `${part.offsetWidth}px`;
  }
  card.style.overflow = 'hidden';

  return () => {
    for (const part of parts) {
      part.style.width = '';
    }
    card.style.overflow = '';
  };
};

const play = (
  card: HTMLElement,
  pill: HTMLElement,
  collapsing: boolean,
): Promise<Animation> => {
  for (const running of card.getAnimations({ subtree: true })) {
    running.cancel();
  }

  const frames = boxes(card, pill);
  const release = hold(card);

  for (const part of card.children) {
    part.animate(
      { opacity: collapsing ? [1, 0] : [0, 1] },
      {
        ...MORPHING,
        duration: collapsing ? 120 : 160,
        delay: collapsing ? 0 : 80,
      },
    );
  }

  const morph = card.animate(
    collapsing ? frames : frames.toReversed(),
    MORPHING,
  );
  morph.finished.then(release, release);

  return morph.finished;
};

const coverOf = (card: HTMLElement | null): number =>
  Math.max(0, -(card?.offsetTop ?? 0));

export function useTrayMotion(
  open: boolean,
  collapse: () => void,
  measure: (cover: number) => void,
) {
  const card = useRef<HTMLElement>(null);
  const pills = useRef<HTMLDivElement>(null);
  const opened = useRef(open);
  const morphing = useRef(false);
  const currentPill = () =>
    pills.current?.querySelector<HTMLElement>('[data-current]') ?? null;

  useLayoutEffect(() => {
    const expanding = open && !opened.current;
    const collapsed = !open && opened.current;
    const pill = currentPill();
    opened.current = open;

    if (collapsed && pill && canAnimate(pill)) {
      for (const part of pill.children) {
        part.animate(
          { opacity: [0, 1] },
          { duration: 100, easing: 'ease-out' },
        );
      }
    }

    if (expanding && pill && canAnimate(card.current)) {
      const expanded = card.current;
      measure(coverOf(expanded));
      morphing.current = true;
      play(expanded, pill, false)
        .then(
          () => {
            for (const done of expanded.getAnimations({ subtree: true })) {
              done.cancel();
            }
          },
          () => {},
        )
        .finally(() => {
          morphing.current = false;
          measure(coverOf(expanded));
        });
    }
  }, [open, measure]);

  useLayoutEffect(() => {
    const covering = () => {
      if (!morphing.current) {
        measure(coverOf(card.current));
      }
    };
    const resized = new ResizeObserver(covering);

    for (const each of [card.current, pills.current]) {
      if (each) {
        resized.observe(each);
      }
    }
    covering();

    return () => resized.disconnect();
  }, [open, measure]);

  return {
    card,
    pills,
    collapse: () => {
      const pill = currentPill();

      if (!pill || !canAnimate(card.current)) {
        collapse();
        return;
      }

      morphing.current = true;
      play(card.current, pill, true)
        .then(collapse, () => {})
        .finally(() => {
          morphing.current = false;
        });
    },
  };
}
