import { type ReactNode, use, type ReactElement } from 'react';

import { CommandScopeContext } from '@/lib/commands/context';

type CommandScopeProps = {
  active: boolean;
  rank?: number;
  children: ReactNode;
};

export function CommandScope({
  active,
  rank = 1,
  children,
}: CommandScopeProps): ReactElement {
  const parent = use(CommandScopeContext);

  return (
    <CommandScopeContext
      value={{ active: parent.active && active, depth: parent.depth + rank }}
    >
      {children}
    </CommandScopeContext>
  );
}
