export const htmlElement = (node: Element | null | undefined): HTMLElement => {
  if (!(node instanceof HTMLElement)) {
    throw new Error('not an HTML element');
  }

  return node;
};

export const inputElement = (
  node: Element | null | undefined,
): HTMLInputElement => {
  if (!(node instanceof HTMLInputElement)) {
    throw new Error('not an input element');
  }

  return node;
};
