import type { LucideIcon } from 'lucide-react';
import { createContext } from 'react';

export type MenuAction = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
};

type ReadActions = () => readonly MenuAction[];

export type MenuActionsRegistry = {
  readonly offer: (id: string, read: ReadActions) => () => void;
  readonly actionsOf: (id: string | null) => readonly MenuAction[];
  readonly changed: (id: string) => void;
  readonly watch: (id: string | null, onChange: () => void) => () => void;
};

const NO_ACTIONS: readonly MenuAction[] = [];

export const menuActionsRegistry = (): MenuActionsRegistry => {
  const regions = new Map<string, ReadActions>();
  const watchers = new Map<string, Set<() => void>>();
  const notify = (id: string) =>
    watchers.get(id)?.forEach((watcher) => watcher());

  return {
    offer: (id, read) => {
      regions.set(id, read);
      notify(id);

      return () => {
        regions.delete(id);
        notify(id);
      };
    },
    actionsOf: (id) =>
      (id === null ? undefined : regions.get(id)?.()) ?? NO_ACTIONS,
    changed: notify,
    watch: (id, onChange) => {
      if (id === null) {
        return () => {};
      }

      const watching = watchers.get(id) ?? new Set();
      watching.add(onChange);
      watchers.set(id, watching);

      return () => {
        watching.delete(onChange);
        if (watching.size === 0) {
          watchers.delete(id);
        }
      };
    },
  };
};

export const MENU_ACTIONS_ATTRIBUTE = 'data-menu-actions';

export const MenuActionsContext = createContext<MenuActionsRegistry | null>(
  null,
);
