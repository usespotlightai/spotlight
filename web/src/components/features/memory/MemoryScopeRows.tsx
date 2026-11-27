import type { ReactElement } from 'react';

import { MemoryKindLabel } from '@/components/features/memory/MemoryKindLabel';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { appliesTo, memoryFilesOf, type ProposedMemory } from '@/lib/memory';
import { nonEmpty } from '@/lib/non-empty';

type MemoryScopeRowsProps = {
  memory: Pick<ProposedMemory, 'kind' | 'scope' | 'repository' | 'paths'>;
};

export function MemoryScopeRows({
  memory,
}: MemoryScopeRowsProps): ReactElement {
  const files = memoryFilesOf(memory);

  return (
    <>
      <FactRow>
        <dt className={FACT_LABEL}>Kind</dt>
        <dd className={FACT_VALUE}>
          <MemoryKindLabel kind={memory.kind} />
        </dd>
      </FactRow>

      <FactRow>
        <dt className={FACT_LABEL}>Applies to</dt>
        <dd className={FACT_VALUE}>{appliesTo(memory)}</dd>
      </FactRow>

      {nonEmpty(files) && (
        <FactRow>
          <dt className={FACT_LABEL}>Files</dt>
          <dd className={FACT_VALUE}>{files}</dd>
        </FactRow>
      )}
    </>
  );
}
