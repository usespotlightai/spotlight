import { MemoryGroundList } from '@/components/features/memory/MemoryGroundList';
import { MemoryScopeRows } from '@/components/features/memory/MemoryScopeRows';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { InPlaceTextarea } from '@/components/shared/form/InPlaceTextarea';
import {
  citesAnything,
  MOST_MEMORY_BODY,
  type ProposedMemory,
} from '@/lib/memory';

type ProposedMemoryFactsProps = {
  memory: ProposedMemory;
  editing: boolean;
  pending: boolean;
  body: string;
  bodyId: string;
  onBody: (body: string) => void;
};

export function ProposedMemoryFacts({
  memory,
  editing,
  pending,
  body,
  bodyId,
  onBody,
}: ProposedMemoryFactsProps) {
  return (
    <dl>
      <FactRow>
        <dt className={FACT_LABEL}>Memory</dt>
        <dd>
          {editing ? (
            <InPlaceTextarea
              id={bodyId}
              value={body}
              disabled={pending}
              autoFocus
              maxLength={MOST_MEMORY_BODY}
              onChange={(event) => onBody(event.target.value)}
              aria-label="The memory as it should stand"
            />
          ) : (
            <p id={bodyId} className={FACT_VALUE}>
              {memory.body}
            </p>
          )}
        </dd>
      </FactRow>

      <MemoryScopeRows memory={memory} />

      {citesAnything(memory) && (
        <FactRow>
          <dt className={FACT_LABEL}>Source</dt>
          <dd>
            <MemoryGroundList grounds={memory} />
          </dd>
        </FactRow>
      )}
    </dl>
  );
}
