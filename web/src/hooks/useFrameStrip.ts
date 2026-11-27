import { type RefObject, useEffect } from 'react';

import { canAnimate } from '@/lib/motion';

export function useFrameStrip(
  strip: RefObject<HTMLElement | null>,
  frames: number,
  frameMs: number,
  moving: boolean,
): void {
  useEffect(() => {
    if (!moving || !canAnimate(strip.current)) {
      return;
    }
    const turning = strip.current.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      {
        duration: frameMs * frames,
        easing: `steps(${frames})`,
        iterations: Infinity,
      },
    );

    return () => turning.cancel();
  }, [strip, frames, frameMs, moving]);
}
