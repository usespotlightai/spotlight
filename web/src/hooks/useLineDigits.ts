import { type RefObject, useEffect, useState } from 'react';

import type { HoveredLine } from '@/components/shared/PatchCodeDiff';

export function useLineDigits(
  inside: RefObject<HTMLElement | null>,
  hovered: HoveredLine,
) {
  const [digits, setDigits] = useState(1);

  useEffect(() => {
    const host = inside.current?.closest('diffs-container');

    if (!host) {
      return;
    }

    const follow = () => {
      const line = hovered();

      if (line) {
        setDigits(String(line.lineNumber).length);
      }
    };

    host.addEventListener('pointermove', follow);
    return () => host.removeEventListener('pointermove', follow);
  }, [inside, hovered]);

  return digits;
}
