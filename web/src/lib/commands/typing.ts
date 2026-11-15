const TYPING_IN =
  'input, textarea, select, [role="dialog"], dialog, [role="menu"], [role="listbox"]';

const OPEN_POPUP =
  '[role="dialog"][data-open], [role="alertdialog"][data-open], [role="menu"][data-open], [role="listbox"][data-open], dialog[open]';

const typingAt = (element: EventTarget | null): boolean =>
  element instanceof HTMLElement &&
  element.closest('[data-closed]') === null &&
  (element.isContentEditable || element.closest(TYPING_IN) !== null);

export const typingIn = (target: EventTarget | null): boolean =>
  document.querySelector(OPEN_POPUP) !== null ||
  [target, document.activeElement].some(typingAt);
