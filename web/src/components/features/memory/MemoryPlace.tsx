import { useState } from 'react';
import { MemoryPlaceNode } from '@/components/features/memory/MemoryPlaceNode';
import type { PlaceNode } from '@/lib/memory';

type MemoryPlaceProps = {
  tree: PlaceNode;
  open: boolean;
};

export function MemoryPlace({ tree, open }: MemoryPlaceProps) {
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const fold = (key: string) =>
    setFolded((was) => {
      const next = new Set(was);

      if (!next.delete(key)) {
        next.add(key);
      }

      return next;
    });

  return (
    <ul
      aria-label="Where it applies"
      className="flex min-w-0 flex-col text-muted-foreground text-xs leading-5 group-data-clamped/row:flex-row group-data-clamped/row:items-center group-data-clamped/row:overflow-hidden group-data-clamped/row:[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]"
    >
      <MemoryPlaceNode
        node={tree}
        at={tree.label}
        root
        last
        open={open}
        folded={folded}
        onFold={fold}
      />
    </ul>
  );
}
