import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useCallback } from 'react';

import { useScrollParent } from '@/hooks/useScrollParent';

type VirtualRowsProps = {
  count: number;
  estimate: number;
  overscan?: number;
  children: (index: number) => ReactNode;
};

export function VirtualRows({
  count,
  estimate,
  overscan = 2,
  children,
}: VirtualRowsProps) {
  'use no memo';

  const { attach, scroller, margin } = useScrollParent();

  // oxlint-disable-next-line react-hooks-js/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    overscan,
    scrollMargin: margin,
    estimateSize: () => estimate,
    getScrollElement: () => scroller,
    initialRect: { width: 0, height: 800 },
  });

  const items = virtualizer.getVirtualItems();
  const first = items.at(0);
  const last = items.at(-1);
  const before = first ? first.start - margin : 0;
  const after = last ? virtualizer.getTotalSize() - last.end : 0;
  const measure = useCallback(
    (element: HTMLLIElement | null) => virtualizer.measureElement(element),
    [virtualizer],
  );

  return (
    <>
      <li
        ref={attach}
        aria-hidden
        className="col-span-full"
        style={{ height: before }}
      />
      {items.map((item) => (
        <li
          key={item.key}
          ref={measure}
          data-index={item.index}
          className="col-span-full grid grid-cols-subgrid"
        >
          <ul className="col-span-full grid grid-cols-subgrid">
            {children(item.index)}
          </ul>
        </li>
      ))}
      {after > 0 && (
        <li aria-hidden className="col-span-full" style={{ height: after }} />
      )}
    </>
  );
}
