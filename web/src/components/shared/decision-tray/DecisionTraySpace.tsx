import { use, useRef, type ReactElement } from 'react';

import { useTraySpace } from '@/hooks/useTraySpace';
import { DecisionTrayContext } from '@/lib/decision-tray';

export function DecisionTraySpace(): ReactElement {
  const cover = use(DecisionTrayContext)?.cover ?? 0;
  const space = useRef<HTMLDivElement>(null);
  const height = useTraySpace(space, cover);

  return (
    <div
      ref={space}
      aria-hidden
      data-slot="decision-tray-space"
      className="shrink-0"
      style={{ height }}
    />
  );
}
