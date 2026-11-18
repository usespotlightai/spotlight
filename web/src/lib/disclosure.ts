export const togglesDisclosure = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[aria-expanded]') !== null;

export const changesInPlace = (target: EventTarget | null): boolean =>
  togglesDisclosure(target) ||
  (target instanceof Element &&
    target.closest('[data-decision] :is(button, a)') !== null);
