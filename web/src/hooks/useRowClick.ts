import type { MouseEvent } from 'react';

const OWN_CLICKS =
  'button, a, input, textarea, select, [role^="menu"], [role="dialog"], form';

type RowClickOptions = {
  readonly ignore?: (target: Element) => boolean;
};

export function useRowClick(
  toggle: () => void,
  { ignore }: RowClickOptions = {},
): (event: MouseEvent<HTMLElement>) => void {
  return (event) => {
    const target = event.target as Element;

    if (
      target.closest(OWN_CLICKS) ||
      ignore?.(target) ||
      window.getSelection()?.toString()
    ) {
      return;
    }
    toggle();
  };
}
