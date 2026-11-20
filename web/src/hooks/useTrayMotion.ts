import { useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

import { canAnimate } from '@/lib/motion';

const MORPHING: KeyframeAnimationOptions = {
  duration: 240,
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  fill: 'both',
};

const HANDING_OVER: Keyframe[] = [
  { opacity: 1 },
  { opacity: 1, offset: 0.5 },
  { opacity: 0 },
];

const TAKING_OVER: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.5 },
  { opacity: 1 },
];

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

const category = (
  card: HTMLElement,
  pill: HTMLElement,
): { label: HTMLElement; frames: Keyframe[] } | null => {
  const label = card.querySelector<HTMLElement>('[data-tray-category]');
  const target = pill.querySelector<HTMLElement>('[data-pill-label]');

  if (!label || !target) {
    return null;
  }

  const box = card.getBoundingClientRect();
  const from = label.getBoundingClientRect();
  const to = pill.getBoundingClientRect();
  const onto = target.getBoundingClientRect();
  const now = getComputedStyle(label);
  const then = getComputedStyle(target);
  const x = onto.left - (to.left + from.left - box.left);
  const y =
    onto.top +
    onto.height / 2 -
    (to.top + from.top + from.height / 2 - box.top);

  return {
    label,
    frames: [
      {
        transform: 'translate(0px, 0px)',
        fontSize: now.fontSize,
        lineHeight: now.lineHeight,
        fontWeight: now.fontWeight,
        color: now.color,
      },
      {
        transform: `translate(${x}px, ${y}px)`,
        fontSize: then.fontSize,
        lineHeight: then.lineHeight,
        fontWeight: then.fontWeight,
        color: then.color,
      },
    ],
  };
};

const fading = (card: HTMLElement, label: HTMLElement | null): Element[] =>
  [...card.children].flatMap((part) =>
    label && part.contains(label)
      ? [...part.children].filter((each) => each !== label)
      : [part],
  );

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
  settle: () => void = () => {},
): Promise<Animation> => {
  for (const running of card.getAnimations({ subtree: true })) {
    running.cancel();
  }

  const frames = boxes(card, pill);
  const moving = category(card, pill);
  const release = hold(card);
  const ordered = (keyframes: Keyframe[]) =>
    collapsing ? keyframes : keyframes.toReversed();

  if (moving) {
    moving.label.animate(ordered(moving.frames), MORPHING);
    const renamed = moving.label.querySelector('[data-collapsed-as]');

    if (renamed) {
      moving.label.firstElementChild?.animate(ordered(HANDING_OVER), MORPHING);
      renamed.animate(ordered(TAKING_OVER), MORPHING);
    }
  }

  for (const part of fading(card, moving?.label ?? null)) {
    part.animate(
      { opacity: collapsing ? [1, 0] : [0, 1] },
      {
        ...MORPHING,
        duration: collapsing ? 180 : 200,
        delay: collapsing ? 0 : 40,
      },
    );
  }

  const morph = card.animate(ordered(frames), MORPHING);
  morph.finished.then(() => {
    settle();
    release();
  }, release);

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
      for (const part of pill.querySelectorAll(
        ':scope > :not([data-pill-label])',
      )) {
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
      play(card.current, pill, true, () => flushSync(collapse))
        .catch(() => {})
        .finally(() => {
          morphing.current = false;
        });
    },
  };
}
