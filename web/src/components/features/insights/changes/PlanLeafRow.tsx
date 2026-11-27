import type { ReactElement } from 'react';

import { PlanRow } from '@/components/features/insights/changes/PlanRow';
import { leafAssigned, type PlanLeaf } from '@/lib/config-plan';

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
      {leaf.name !== null &&
        leaf.name !== '' &&
        (assigned ? `${leaf.name.padEnd(width)} = ` : leaf.name)}
      {leaf.was !== null &&
      leaf.was !== '' &&
      leaf.now !== null &&
      leaf.now !== '' ? (
        <>
          {leaf.was}
          <span className="text-muted-foreground">{' -> '}</span>
          {leaf.now}
        </>
      ) : (
        (leaf.now ?? leaf.was)
      )}
      {leaf.note !== null && leaf.note !== '' && (
        <span className="text-muted-foreground"> # {leaf.note}</span>
      )}
    </PlanRow>
  );
}
