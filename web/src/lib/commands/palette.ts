import {
  Archive,
  Box,
  Check,
  CircleDashed,
  Keyboard,
  type LucideIcon,
  Package,
  PanelLeft,
  Play,
  Plus,
  Reply,
  Settings2,
  Trash,
  UserRound,
  X,
} from 'lucide-react';

import type { Registered } from '@/lib/commands/registry';
import { type ShortcutId, shortcutOf } from '@/lib/commands/shortcuts';

export type PaletteAction = {
  readonly id: ShortcutId;
  readonly title: string;
  readonly icon: LucideIcon;
  readonly navigates: boolean;
  readonly run: () => void;
};

const ICONS: Partial<Record<ShortcutId, LucideIcon>> = {
  'shortcuts.show': Keyboard,
  'sidebar.toggle': PanelLeft,
  'go.lines': Package,
  'go.settings': Settings2,
  'open.line': Package,
  'open.station': Box,
  'open.task': CircleDashed,
  'list.clear': X,
  'task.create': Plus,
  'task.station': Box,
  'task.backlog': Archive,
  'task.complete': Check,
  'task.assign': UserRound,
  'task.resume': Play,
  'task.delete': Trash,
  'inbox.resolve': Archive,
  'inbox.reply': Reply,
  'approval.approve': Check,
};

const onSelection = (command: Registered) =>
  shortcutOf(command.id).onSelection === true;

export const paletteActions = (
  commands: readonly Registered[],
): PaletteAction[] =>
  [
    ...commands.filter(onSelection),
    ...commands.filter((command) => !onSelection(command)),
  ]
    .filter((command) => {
      const shortcut = shortcutOf(command.id);

      return shortcut.inPalette !== false && !shortcut.focused && !command.to;
    })
    .map((command) => ({
      id: command.id,
      title: command.title ?? shortcutOf(command.id).title,
      icon: ICONS[command.id] ?? CircleDashed,
      navigates: shortcutOf(command.id).group === 'Navigation',
      run: command.run,
    }));

export const shortcutFor = (
  commands: readonly Registered[],
  to: string,
): ShortcutId | null =>
  commands.find((command) => command.to === to)?.id ?? null;
