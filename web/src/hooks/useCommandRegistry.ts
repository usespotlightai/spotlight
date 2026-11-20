import { useEffect, useState } from 'react';

import { listenForKeys } from '@/lib/commands/listener';
import { CommandRegistry } from '@/lib/commands/registry';

export function useCommandRegistry() {
  const [registry] = useState(() => new CommandRegistry());

  useEffect(() => listenForKeys(registry), [registry]);

  return registry;
}
