import { type RefObject, useEffect } from 'react';

import type { LineRange } from '@/lib/changes';

const MAX_TRIES = 60;

export function useScrollToSelectedLine(
  container: RefObject<HTMLElement | null>,
  lines: LineRange | null,
  ready: boolean,
): void {
  useEffect(() => {
    if (!ready || !lines) {
      return;
    }

    let tries = 0;
    let waiting = 0;

    const find = () => {
      const shown = [...(container.current?.querySelectorAll('*') ?? [])]
        .find((each) => each.shadowRoot)
        ?.shadowRoot?.querySelector('[data-selected-line]');

      if (shown) {
        shown.scrollIntoView({ block: 'center' });
      } else if (tries < MAX_TRIES) {
        tries += 1;
        waiting = requestAnimationFrame(find);
      }
    };

    waiting = requestAnimationFrame(find);

    return () => cancelAnimationFrame(waiting);
  }, [container, ready, lines]);
}
