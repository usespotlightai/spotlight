import type { RefObject } from 'react';

import { useCommands } from '@/hooks/useCommands';
import type { Command } from '@/lib/commands/registry';
import { checkboxOf, focusedItem, focusNext } from '@/lib/list-focus';

export function useListKeys(
  list: RefObject<HTMLElement | null>,
  onClear?: () => void,
): void {
  const within = (act: (container: HTMLElement) => void) => () => {
    if (list.current) {
      act(list.current);
    }
  };
  const focusedCheckbox = () =>
    list.current ? checkboxOf(focusedItem(list.current)) : null;

  const commands: Command[] = [
    { id: 'list.next', run: within((container) => focusNext(container, 1)) },
    {
      id: 'list.previous',
      run: within((container) => focusNext(container, -1)),
    },
    {
      id: 'list.select',
      run: () => focusedCheckbox()?.click(),
      enabled: () => focusedCheckbox() !== null,
    },
    ...(onClear ? [{ id: 'list.clear' as const, run: onClear }] : []),
  ];

  useCommands(commands);
}
