import { useActiveCommands } from '@/hooks/useActiveCommands';
import type { Registered } from '@/lib/commands/registry';
import type { ShortcutId } from '@/lib/commands/shortcuts';

type CommandQuery = { readonly id: ShortcutId } | { readonly to: string };

export function useActiveCommand(query: CommandQuery): Registered | null {
  return (
    useActiveCommands().find((command) =>
      'id' in query ? command.id === query.id : command.to === query.to,
    ) ?? null
  );
}
