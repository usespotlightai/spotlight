import { type RefObject, useEffect, useRef } from 'react';

export function useRevealWhenOpened(
  element: RefObject<HTMLElement | null>,
  open: boolean,
) {
  const toggledHere = useRef(false);

  useEffect(() => {
    if (open && !toggledHere.current) {
      element.current?.scrollIntoView?.({ block: 'nearest' });
    }
    toggledHere.current = false;
  }, [open, element]);

  return () => {
    toggledHere.current = true;
  };
}
