import { type RefObject, useEffect, useRef } from 'react';

const NEXT = '[data-focus-next]:not(:disabled)';

const lostFocus = (card: HTMLElement): boolean =>
  !card.contains(document.activeElement) ||
  document.activeElement === card ||
  (document.activeElement as HTMLButtonElement | null)?.disabled === true;

export function useFocusAfterDecision<T extends HTMLElement>(
  card: RefObject<T | null>,
  state: unknown,
): () => void {
  const deciding = useRef(false);

  useEffect(() => {
    const box = card.current;
    if (!deciding.current || !box || !lostFocus(box)) {
      return;
    }
    const next = box.querySelector<HTMLElement>(NEXT);
    if (next) {
      deciding.current = false;
    }
    (next ?? box).focus({ preventScroll: true });
  }, [card, state]);

  return () => {
    deciding.current = true;
  };
}
