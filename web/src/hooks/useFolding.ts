import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useGlide } from '@/hooks/useGlide';
import { glideBetween, placementOf, placementWithout } from '@/lib/flip';
import { canGlide } from '@/lib/glide';

type Folding = {
  readonly rows: RefObject<HTMLLIElement | null>;
  readonly shown: boolean;
};

export function useFolding(open: boolean): Folding {
  const rows = useRef<HTMLLIElement>(null);
  const was = useRef(open);
  const [shown, setShown] = useState(open);
  const glide = useGlide();

  if (open && !shown) {
    setShown(true);
  }

  useLayoutEffect(() => {
    if (open === was.current) {
      return;
    }
    was.current = open;
    const element = rows.current;
    const done = open ? undefined : () => setShown(false);

    if (glide.reverse(done)) {
      return;
    }

    if (!canGlide(element)) {
      done?.();
      return;
    }

    const unfolded = placementOf(element);
    const folded = placementWithout(element);

    glide.play(
      open
        ? glideBetween(unfolded, folded, unfolded)
        : glideBetween(unfolded, unfolded, folded),
      done,
    );
  }, [open, glide]);

  return { rows, shown };
}
