const TYPING_IN =
  'input, textarea, select, [role="dialog"], dialog, [role="menu"], [role="listbox"]';

export const typingIn = (target: EventTarget | null): boolean =>
  [target, document.activeElement].some(
    (element) =>
      element instanceof HTMLElement &&
      (element.isContentEditable || element.closest(TYPING_IN) !== null),
  );
