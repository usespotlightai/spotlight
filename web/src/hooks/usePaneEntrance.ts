import { type RefObject, useLayoutEffect, useRef } from 'react';

import { canAnimate, SPRING_MS } from '@/lib/motion';
import { PANE_GAP_PX } from '@/lib/panes';

const KEY_SEPARATOR = '\n';

const sectionOf = (column: HTMLElement) =>
  column.querySelector<HTMLElement>('[data-slot="pane"]');

const enteredOnTheLeft = (keys: string[], before: string[]) => {
  const [main, split] = keys;

  return split !== undefined && split === before[0] && !before.includes(main);
};

export function usePaneEntrance(
  rowRef: RefObject<HTMLElement | null>,
  keys: string[],
) {
  const signature = keys.join(KEY_SEPARATOR);
  const before = useRef(signature);

  useLayoutEffect(() => {
    const entered = enteredOnTheLeft(
      signature.split(KEY_SEPARATOR),
      before.current.split(KEY_SEPARATOR),
    );
    before.current = signature;
    const row = rowRef.current;
    if (!entered || !canAnimate(row) || row.children.length !== 2) {
      return;
    }

    const [main, split] = [...row.children] as HTMLElement[];
    for (const running of [main, split].flatMap((column) =>
      column.getAnimations(),
    )) {
      running.finish();
    }
    const section = sectionOf(main);
    const room = row.clientWidth;
    const mainWidth = main.getBoundingClientRect().width;
    const splitWidth = split.getBoundingClientRect().width;
    const timing: KeyframeAnimationOptions = {
      duration: SPRING_MS,
      easing: section
        ? getComputedStyle(section).transitionTimingFunction
        : 'ease-out',
    };

    split.animate(
      [
        { width: `${room}px`, maxWidth: `${room}px` },
        { width: `${splitWidth}px`, maxWidth: `${splitWidth}px` },
      ],
      timing,
    );
    main.animate(
      [
        { minWidth: '0px', marginRight: `${-PANE_GAP_PX}px` },
        { minWidth: '0px', marginRight: '0px' },
      ],
      timing,
    );
    section?.animate(
      [{ minWidth: `${mainWidth}px` }, { minWidth: `${mainWidth}px` }],
      timing,
    );
  }, [rowRef, signature]);
}
