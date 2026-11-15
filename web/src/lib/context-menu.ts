import type { LucideIcon } from 'lucide-react';
import { createContext } from 'react';

export type MenuAction = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
};

export type MenuActionsRegistry = Map<string, readonly MenuAction[]>;

export const MENU_ACTIONS_ATTRIBUTE = 'data-menu-actions';

export const MenuActionsContext = createContext<MenuActionsRegistry | null>(
  null,
);
