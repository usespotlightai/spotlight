import type { ReactNode, ReactElement } from 'react';

import { useCommandRegistry } from '@/hooks/useCommandRegistry';
import { CommandsContext } from '@/lib/commands/context';

export function CommandsProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const registry = useCommandRegistry();

  return <CommandsContext value={registry}>{children}</CommandsContext>;
}
