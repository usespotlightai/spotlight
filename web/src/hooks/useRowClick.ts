import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

const OWN_CLICKS =
  'button, a, input, textarea, select, [role^="menu"], [role="dialog"], form';

type RowClickOptions = {
  readonly ignore?: (target: Element) => boolean;
};

export function useRowClick(
  row: RefObject<HTMLElement | null>,
  toggle: () => void,
  { ignore }: RowClickOptions = {},
): void {
  const latest = useRef({ toggle, ignore });

  useLayoutEffect(() => {
    latest.current = { toggle, ignore };
  });

  useEffect(() => {
    const element = row.current;

    if (!element) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;

      if (
        target.closest(OWN_CLICKS) ||
        latest.current.ignore?.(target) ||
        window.getSelection()?.toString()
      ) {
        return;
      }
      latest.current.toggle();
    };

    element.addEventListener('click', onClick);

    return () => element.removeEventListener('click', onClick);
  }, [row]);
}
