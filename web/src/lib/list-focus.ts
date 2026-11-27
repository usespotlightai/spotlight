const LIST_ITEM = 'data-list-item';

const shown = (item: HTMLElement) =>
  item.closest('[inert]') === null &&
  (!('checkVisibility' in item) || item.checkVisibility());

const listItems = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll<HTMLElement>(`[${LIST_ITEM}]`)].filter(shown);

const focusTargetOf = (item: HTMLElement): HTMLElement =>
  item.querySelector<HTMLElement>('a[href]') ?? item;

export const focusedItem = (container: HTMLElement): HTMLElement | null => {
  const focused = document.activeElement?.closest<HTMLElement>(
    `[${LIST_ITEM}]`,
  );

  return focused && container.contains(focused) ? focused : null;
};

export const focusNext = (container: HTMLElement, step: 1 | -1): void => {
  const items = listItems(container);
  const current = focusedItem(container);
  const at = current ? items.indexOf(current) : -1;
  const next =
    at === -1
      ? items.at(step > 0 ? 0 : items.length - 1)
      : items.at(Math.min(items.length - 1, Math.max(0, at + step)));

  if (next === undefined) {
    return;
  }

  focusTargetOf(next).focus();
  if ('scrollIntoView' in next) {
    next.scrollIntoView({ block: 'nearest' });
  }
};

export const checkboxOf = (item: HTMLElement | null): HTMLElement | null =>
  item?.querySelector<HTMLElement>(
    '[role="checkbox"], input[type="checkbox"]',
  ) ?? null;
