import { useLayoutEffect, useRef } from 'react';

import { changesInPlace } from '@/lib/disclosure';

const CLOSE = 80;

const FADE_BELOW_HEAD = 24;

const latestTop = (
  box: HTMLDivElement,
  inside: HTMLDivElement,
  fromTop: boolean,
): number => {
  const bottom = box.scrollHeight - box.clientHeight;
  const latest = inside.querySelector(
    ':scope > section:last-of-type > ol > li:last-child[data-note]',
  );

  if (!latest) {
    return bottom;
  }

  const head = latest.closest('section')?.querySelector(':scope > [data-head]');
  const covered =
    head instanceof HTMLElement && getComputedStyle(head).position === 'sticky'
      ? head.offsetHeight + FADE_BELOW_HEAD
      : null;

  if (covered === null && !fromTop) {
    return bottom;
  }

  const top =
    latest.getBoundingClientRect().top -
    box.getBoundingClientRect().top +
    box.scrollTop -
    (covered ?? 0);

  return Math.min(bottom, Math.max(0, top));
};

const toLatest = (
  box: HTMLDivElement,
  inside: HTMLDivElement,
  fromTop: boolean,
) => {
  box.scrollTop = box.scrollHeight;
  box.scrollTop = latestTop(box, inside, fromTop);
};

const put = (
  box: HTMLDivElement,
  inside: HTMLDivElement,
  at: number | null,
  fromTop: boolean,
): boolean => {
  const note = at === null ? null : inside.querySelector(`[data-note="${at}"]`);
  const was = box.scrollTop;

  if (note) {
    box.scrollTop =
      note.getBoundingClientRect().top -
      box.getBoundingClientRect().top +
      box.scrollTop;
  } else {
    toLatest(box, inside, fromTop);
  }

  return box.scrollTop !== was;
};

export function useConversationScroll(
  itemId: string,
  openAt: number | null,
  setup: boolean,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const pinnedAt = useRef<number | null>(null);
  const ours = useRef(false);

  useLayoutEffect(() => {
    const box = scroller.current;
    const inside = content.current;

    if (!box || !inside) {
      return;
    }

    pinnedAt.current = openAt;
    following.current = pinnedAt.current === null;
    ours.current = put(box, inside, pinnedAt.current, setup);

    const grew = new ResizeObserver(() => {
      if (pinnedAt.current !== null) {
        ours.current =
          put(box, inside, pinnedAt.current, setup) || ours.current;
        return;
      }

      if (!following.current) {
        return;
      }

      const was = box.scrollTop;
      toLatest(box, inside, setup);
      // A reflow, such as a side panel opening, never pulls the reader back up.
      if (box.scrollTop < was) {
        box.scrollTop = was;
      }
      ours.current = box.scrollTop !== was || ours.current;
    });
    grew.observe(inside);

    const toggled = (event: Event) => {
      if (changesInPlace(event.target)) {
        pinnedAt.current = null;
        following.current = false;
      }
    };
    box.addEventListener('click', toggled, true);

    return () => {
      grew.disconnect();
      box.removeEventListener('click', toggled, true);
    };
  }, [itemId, openAt, setup]);

  const watched = () => {
    const box = scroller.current;

    if (!box) {
      return;
    }

    if (ours.current) {
      ours.current = false;
      return;
    }

    pinnedAt.current = null;
    following.current =
      box.scrollHeight - box.scrollTop - box.clientHeight < CLOSE;
  };

  return { scroller, content, watched };
}
