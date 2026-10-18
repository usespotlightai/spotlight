import { useState } from 'react';

export type Collapsibles = {
  readonly isOpen: (key: string) => boolean;
  readonly toggle: (key: string) => void;
};

export function useCollapsibles(): Collapsibles {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  return {
    isOpen: (key) => !collapsed.has(key),
    toggle: (key) =>
      setCollapsed((was) => {
        const next = new Set(was);
        if (!next.delete(key)) {
          next.add(key);
        }
        return next;
      }),
  };
}
