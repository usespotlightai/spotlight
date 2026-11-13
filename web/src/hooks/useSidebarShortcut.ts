import { useEffect, useEffectEvent } from 'react';

const TOGGLE_KEY = '[';

const SHOWS_SIDEBAR = '(min-width: 48rem)';

const ELSEWHERE =
  'input, textarea, select, [role="dialog"], dialog, [role="menu"], [role="listbox"]';

const sidebarShown = () =>
  typeof window.matchMedia !== 'function' ||
  window.matchMedia(SHOWS_SIDEBAR).matches;

const busy = (target: EventTarget | null) =>
  [target, document.activeElement].some(
    (element) =>
      element instanceof HTMLElement &&
      (element.isContentEditable || element.closest(ELSEWHERE) !== null),
  );

export function useSidebarShortcut(onToggle: () => void, enabled: boolean) {
  const toggle = useEffectEvent(onToggle);

  useEffect(() => {
    if (!enabled) {
      return;
    }

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
  }, [enabled]);
}
