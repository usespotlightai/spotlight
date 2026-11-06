import { useState } from 'react';

type Opened = {
  readonly key: string;
  readonly open: ReadonlyMap<number, boolean>;
};

export function useOpenTurns(key: string, kept: readonly boolean[]) {
  const [opened, setOpened] = useState<Opened>(() => ({
    key,
    open: new Map(),
  }));
  const current = opened.key === key ? opened.open : new Map<number, boolean>();
  const unseen = kept.some((each, at) => each && !current.has(at));

  if (opened.key !== key || unseen) {
    const next = new Map(current);
    kept.forEach((each, at) => {
      if (each && !next.has(at)) {
        next.set(at, true);
      }
    });
    setOpened({ key, open: next });
  }

  return {
    isOpen: (at: number): boolean =>
      (kept[at] ?? false) || (current.get(at) ?? false),
    toggle: (at: number) =>
      setOpened((was) => ({
        key: was.key,
        open: new Map(was.open).set(at, !(was.open.get(at) ?? false)),
      })),
  };
}
