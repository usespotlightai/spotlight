import type { ReactElement } from 'react';

import { PlanRow } from '@/components/features/insights/changes/PlanRow';
import { leafAssigned, type PlanLeaf } from '@/lib/config-plan';
import { nonEmpty } from '@/lib/non-empty';

type PlanLeafRowProps = {
  leaf: PlanLeaf;
  width: number;
  depth?: number;
};

export function PlanLeafRow({
  leaf,
  width,
  depth = 0,
}: PlanLeafRowProps): ReactElement {
  const assigned = leafAssigned(leaf);

  return (
    <PlanRow mark={leaf.mark} depth={depth}>
      {nonEmpty(leaf.name) &&
        (assigned ? `${leaf.name.padEnd(width)} = ` : leaf.name)}
      {nonEmpty(leaf.was) && nonEmpty(leaf.now) ? (
        <>
          {leaf.was}
          <span className="text-muted-foreground">{' -> '}</span>
          {leaf.now}
        </>
      ) : (
        (leaf.now ?? leaf.was)
      )}
      {nonEmpty(leaf.note) && (
        <span className="text-muted-foreground"> # {leaf.note}</span>
      )}
    </PlanRow>
  );
}
