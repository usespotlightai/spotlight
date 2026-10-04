import { useId, useState } from 'react';
import { ProposedMemoryControls } from '@/components/features/inbox/memories/ProposedMemoryControls';
import { ProposedMemoryFacts } from '@/components/features/inbox/memories/ProposedMemoryFacts';
import { DecisionActions } from '@/components/shared/DecisionActions';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import {
  MOST_MEMORY_BODY,
  type ProposedMemory,
  proposalStandingOf,
  proposalTitleOf,
  undecided,
} from '@/lib/memory';

type ProposedMemoryCardProps = {
  memory: ProposedMemory;
  position: number;
  pending: boolean;
  failed: boolean;
  onApprove: (body?: string) => void;
  onReject: () => void;
};

export function ProposedMemoryCard({
  memory,
  position,
  pending,
  failed,
  onApprove,
  onReject,
}: ProposedMemoryCardProps) {
  const [editingOpen, setEditing] = useState(false);
  const [body, setBody] = useState(memory.body);
  const open = undecided(memory);
  const editing = editingOpen && open;
  const bodyId = useId();
  const written = body.trim();
  const ready =
    !editing || (written.length > 0 && written.length <= MOST_MEMORY_BODY);

  return (
    <DecisionCard as="li" data-slot="proposed-memory">
      <DecisionHeader
        title={
          <DecisionTitle standing={proposalStandingOf(memory)}>
            {proposalTitleOf(memory)}
          </DecisionTitle>
        }
        trailing={
          !editing && (
            <DecisionActions
              copy={{ text: memory.body, label: `Copy memory ${position}` }}
              editLabel={`Edit memory ${position}`}
              pending={pending}
              onEdit={open ? () => setEditing(true) : undefined}
            />
          )
        }
      />

      <ProposedMemoryFacts
        memory={memory}
        editing={editing}
        pending={pending}
        body={body}
        bodyId={bodyId}
        onBody={setBody}
      />

      {open && failed && (
        <p role="alert" className="text-destructive text-xs">
          It could not be saved. Try again.
        </p>
      )}

      <ProposedMemoryControls
        position={position}
        pending={pending}
        editing={editing}
        ready={ready}
        bodyId={bodyId}
        onApprove={
          open
            ? () =>
                onApprove(
                  editing && written !== memory.body ? written : undefined,
                )
            : undefined
        }
        onReject={open ? onReject : undefined}
        onCancel={() => {
          setBody(memory.body);
          setEditing(false);
        }}
      />
    </DecisionCard>
  );
}
