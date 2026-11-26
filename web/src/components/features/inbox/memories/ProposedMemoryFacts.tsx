import { use } from 'react';

import { ExpandableText } from '@/components/features/inbox/conversation/ExpandableText';
import { MemoryProvenanceList } from '@/components/features/memory/MemoryProvenanceList';
import { MemoryScopeRows } from '@/components/features/memory/MemoryScopeRows';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { InPlaceTextarea } from '@/components/shared/form/InPlaceTextarea';
import { DockedContext } from '@/lib/decision-tray';
import {
  citesAnything,
  MAX_MEMORY_BODY,
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
  const docked = use(DockedContext) !== null;
  const text = (
    <p id={bodyId} className={FACT_VALUE}>
      {memory.body}
    </p>
  );

  return (
    <dl>
      {memory.retires && (
        <FactRow>
          <dt className={FACT_LABEL}>Retires</dt>
          <dd className={FACT_VALUE}>{memory.retires.handle}</dd>
        </FactRow>
      )}

      {memory.retires && (
        <FactRow>
          <dt className={FACT_LABEL}>Reason</dt>
          <dd className={FACT_VALUE}>{memory.retires.reason}</dd>
        </FactRow>
      )}

      <FactRow>
        <dt className={FACT_LABEL}>Memory</dt>
        <dd>
          {editing ? (
            <InPlaceTextarea
              id={bodyId}
              value={body}
              disabled={pending}
              autoFocus
              maxLength={MAX_MEMORY_BODY}
              onChange={(event) => onBody(event.target.value)}
              aria-label="The memory as it should be"
            />
          ) : docked ? (
            text
          ) : (
            <ExpandableText what="memory">{text}</ExpandableText>
          )}
        </dd>
      </FactRow>

      {memory.similarTo && (
        <FactRow>
          <dt className={FACT_LABEL}>Similar to</dt>
          <dd className={FACT_VALUE}>
            {memory.similarTo.handle}{' '}
            <span className="text-muted-foreground">
              {memory.similarTo.body}
            </span>
          </dd>
        </FactRow>
      )}

      <MemoryScopeRows memory={memory} />

      {citesAnything(memory) && (
        <FactRow>
          <dt className={FACT_LABEL}>Source</dt>
          <dd>
            <MemoryProvenanceList provenance={memory} />
          </dd>
        </FactRow>
      )}
    </dl>
  );
}
