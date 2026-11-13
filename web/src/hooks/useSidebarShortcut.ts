import { useEffect, useEffectEvent } from 'react';

const TOGGLE_KEY = '[';

const SHOWS_SIDEBAR = '(min-width: 48rem)';

const ELSEWHERE =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], dialog, [role="menu"], [role="listbox"]';

const sidebarShown = () =>
  typeof window.matchMedia !== 'function' ||
  window.matchMedia(SHOWS_SIDEBAR).matches;

const busy = (target: EventTarget | null) =>
  [target, document.activeElement].some(
    (element) =>
      element instanceof HTMLElement &&
      (element.isContentEditable || element.closest(ELSEWHERE) !== null),
  );

export function useSidebarShortcut(onToggle: () => void) {
  const toggle = useEffectEvent(onToggle);

  useEffect(() => {
    const pressed = (event: KeyboardEvent) => {
      if (
        event.key !== TOGGLE_KEY ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.defaultPrevented ||
        !sidebarShown() ||
        busy(event.target)
      ) {
        return;
      }

      event.preventDefault();
      toggle();
    };

    document.addEventListener('keydown', pressed);

    return () => document.removeEventListener('keydown', pressed);
  }, []);
}
