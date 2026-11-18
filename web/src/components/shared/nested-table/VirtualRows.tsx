import { useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useCallback, useLayoutEffect, useState } from 'react';

type VirtualRowsProps = {
  count: number;
  estimate: number;
  overscan?: number;
  children: (index: number) => ReactNode;
};

const scrollerOf = (element: HTMLElement | null): HTMLElement | null => {
  for (let at = element?.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);

    if (overflowY === 'auto' || overflowY === 'scroll') {
      return at;
    }
  }

  return null;
};

export function VirtualRows({
  count,
  estimate,
  overscan = 2,
  children,
}: VirtualRowsProps) {
  'use no memo';

  const [list, setList] = useState<HTMLLIElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    const found = scrollerOf(list);
    setScroller(found);

    if (list && found) {
      setMargin(
        list.getBoundingClientRect().top -
          found.getBoundingClientRect().top +
          found.scrollTop,
      );
    }
  }, [list]);

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
  const first = items[0];
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
        ref={setList}
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
