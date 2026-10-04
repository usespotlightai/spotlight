import { MemoryKindLabel } from '@/components/features/memory/MemoryKindLabel';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { appliesTo, memoryFilesOf, type ProposedMemory } from '@/lib/memory';

type MemoryScopeRowsProps = {
  memory: Pick<ProposedMemory, 'kind' | 'reach' | 'repository' | 'paths'>;
};

export function MemoryScopeRows({ memory }: MemoryScopeRowsProps) {
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

      {files && (
        <FactRow>
          <dt className={FACT_LABEL}>Files</dt>
          <dd className={FACT_VALUE}>{files}</dd>
        </FactRow>
      )}
    </>
  );
}
