import { createContext } from 'react';

import type { CommandRegistry } from '@/lib/commands/registry';

export const CommandsContext = createContext<CommandRegistry | null>(null);

export type CommandScopeValue = {
  readonly active: boolean;
  readonly depth: number;
};

export const CommandScopeContext = createContext<CommandScopeValue>({
  active: true,
  depth: 0,
});
