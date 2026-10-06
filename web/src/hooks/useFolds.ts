import { useState } from 'react';

export type Folds = {
  readonly isOpen: (key: string) => boolean;
  readonly toggle: (key: string) => void;
};

export function useFolds(): Folds {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());

  return {
    isOpen: (key) => !folded.has(key),
    toggle: (key) =>
      setFolded((was) => {
        const next = new Set(was);
        if (!next.delete(key)) {
          next.add(key);
        }
        return next;
      }),
  };
}
