export const togglesDisclosure = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[aria-expanded]') !== null;
