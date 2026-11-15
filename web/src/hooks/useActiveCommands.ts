import { use, useSyncExternalStore } from 'react';

import { CommandsContext } from '@/lib/commands/context';
import { activeCommands, type Registered } from '@/lib/commands/registry';

const NONE: readonly Registered[] = [];
const quiet = () => () => {};
const none = () => NONE;

export function useActiveCommands(): Registered[] {
  const registry = use(CommandsContext);
  const entries = useSyncExternalStore(
    registry?.subscribe ?? quiet,
    registry?.snapshot ?? none,
  );

  return activeCommands(entries);
}
