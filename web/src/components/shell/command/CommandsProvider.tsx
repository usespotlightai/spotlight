import { type ReactNode, useEffect, useState } from 'react';

import { CommandsContext } from '@/lib/commands/context';
import { listenForKeys } from '@/lib/commands/listener';
import { CommandRegistry } from '@/lib/commands/registry';

export function CommandsProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new CommandRegistry());

  useEffect(() => listenForKeys(registry), [registry]);

  return <CommandsContext value={registry}>{children}</CommandsContext>;
}
