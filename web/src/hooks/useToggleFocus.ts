import { type RefObject, useLayoutEffect, useRef } from 'react';

type ToggleFocusProps = {
  paneRef: RefObject<HTMLElement | null>;
  asideRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  hidden: boolean;
  collapsed: boolean;
  pinned: boolean;
  desktop: boolean;
  touch: boolean;
  narrow: boolean;
};

export function useToggleFocus({
  paneRef,
  asideRef,
  toggleRef,
  hidden,
  collapsed,
  pinned,
  desktop,
  touch,
  narrow,
}: ToggleFocusProps) {
  const restoreRef = useRef<HTMLElement | null>(null);
  const opened = !collapsed || pinned;
  const reachable = desktop || (touch && !narrow);

  useLayoutEffect(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return;
    }

    if (hidden && paneRef.current?.contains(active)) {
      restoreRef.current = active;
      toggleRef.current?.focus();
    } else if (opened && !reachable && active === toggleRef.current) {
      const aside = asideRef.current;
      const restore = restoreRef.current?.isConnected
        ? restoreRef.current
        : aside?.querySelector<HTMLElement>('a[href]');
      (restore ?? aside)?.focus();
    }
  }, [hidden, opened, reachable, paneRef, asideRef, toggleRef]);
}
