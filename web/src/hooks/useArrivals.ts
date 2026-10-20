import { useState } from 'react';

type Loaded<Key> = { readonly scope: string; readonly keys: ReadonlySet<Key> };

export function useArrivals<Key>(
  scope: string,
  present: readonly Key[],
): (key: Key) => boolean {
  const [loaded, setLoaded] = useState<Loaded<Key>>(() => ({
    scope,
    keys: new Set(present),
  }));

  if (loaded.scope !== scope) {
    setLoaded({ scope, keys: new Set(present) });
  }

  const keys = loaded.scope === scope ? loaded.keys : new Set(present);

  return (key) => !keys.has(key);
}
