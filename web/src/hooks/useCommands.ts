import { use, useEffect, useRef } from 'react';

import { CommandScopeContext, CommandsContext } from '@/lib/commands/context';
import type { Command } from '@/lib/commands/registry';

const signatureOf = (commands: readonly Command[]) =>
  commands
    .map((each) => `${each.id}:${each.title ?? ''}:${each.to ?? ''}`)
    .join('|');

export function useCommands(commands: readonly Command[]): void {
  const registry = use(CommandsContext);
  const { active, depth } = use(CommandScopeContext);
  const latest = useRef(commands);
  const signature = active ? signatureOf(commands) : '';

  useEffect(() => {
    latest.current = commands;
  });

  useEffect(() => {
    if (!registry || !signature) {
      return;
    }

    const removals = latest.current.map((command, at) =>
      registry.add(
        {
          ...command,
          run: () => latest.current[at]?.run(),
          enabled: () => latest.current[at]?.enabled?.() ?? true,
        },
        depth,
      ),
    );

    return () => {
      for (const remove of removals) {
        remove();
      }
    };
  }, [registry, signature, depth]);
}
