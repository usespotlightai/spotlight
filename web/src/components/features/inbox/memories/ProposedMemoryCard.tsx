import { use, useId, useRef, useState } from 'react';

import { ProposedMemoryControls } from '@/components/features/inbox/memories/ProposedMemoryControls';
import { ProposedMemoryFacts } from '@/components/features/inbox/memories/ProposedMemoryFacts';
import { RetirementLapsedNote } from '@/components/features/inbox/memories/RetirementLapsedNote';
import { Collapsible } from '@/components/shared/Collapsible';
import { DecisionActions } from '@/components/shared/DecisionActions';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { FoldToggle } from '@/components/shared/FoldToggle';
import { useFocusAfterDecision } from '@/hooks/useFocusAfterDecision';
import {
  approvable,
  dimmed,
  lapsedRetirementsOf,
  MAX_MEMORY_BODY,
  type ProposedMemory,
  proposalStatusOf,
  proposalTitleOf,
  undecided,
} from '@/lib/memory';
import { NOT_DECIDED, SettledPartContext } from '@/lib/settled-part';
import { cn } from '@/lib/utils';

type ProposedMemoryCardProps = {
  memory: ProposedMemory;
  position: number;
  pending: boolean;
  onApprove: (body?: string) => void;
  onReject: () => void;
  onRestore: () => void;
};

// A proposal still open on a resolved inbox item was not decided. A folded,
// rejected one shows its words beside the title.
function ProposedMemoryTitle({
  memory,
  folded,
}: {
  memory: ProposedMemory;
  folded: boolean;
}) {
  const settled = use(SettledPartContext);

  return (
    <DecisionTitle status={proposalStatusOf(memory)}>
      {settled && undecided(memory) ? NOT_DECIDED : proposalTitleOf(memory)}
      {folded && (
        <span className="ml-2 font-normal text-muted-foreground">
          {memory.body}
        </span>
      )}
    </DecisionTitle>
  );
}

export function ProposedMemoryCard({
  memory,
  position,
  pending,
  onApprove,
  onReject,
  onRestore,
}: ProposedMemoryCardProps) {
  const card = useRef<HTMLElement>(null);
  const decided = useFocusAfterDecision(card, `${memory.state}:${pending}`);
  const [editingOpen, setEditing] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const rejected = memory.state === 'rejected';
  const folded = rejected && !unfolded;
  const [body, setBody] = useState(memory.body);
  const open = undecided(memory);
  const editing = editingOpen && open;
  const bodyId = useId();
  const written = body.trim();
  const ready =
    !editing || (written.length > 0 && written.length <= MAX_MEMORY_BODY);

  return (
    <DecisionCard
      ref={card}
      data-slot="proposed-memory"
      className={cn(
        'gap-0 transition-[opacity,padding] duration-200 ease-out-quad motion-reduce:transition-none',
        dimmed(memory) && 'opacity-70',
        folded && 'pb-2',
      )}
    >
      <DecisionHeader
        className={cn(folded && 'mb-0')}
        title={<ProposedMemoryTitle memory={memory} folded={folded} />}
        trailing={
          !editing && (
            <span className="flex shrink-0 items-center gap-1">
              <DecisionActions
                copy={{ text: memory.body, label: `Copy memory ${position}` }}
                editLabel={`Edit memory ${position}`}
                pending={pending}
                onEdit={memory.editable ? () => setEditing(true) : undefined}
                restoreLabel={`Restore memory ${position}`}
                onRestore={
                  rejected
                    ? () => {
                        decided();
                        setUnfolded(false);
                        onRestore();
                      }
                    : undefined
                }
              />
              {rejected && (
                <FoldToggle
                  folded={folded}
                  what={`memory ${position}`}
                  onToggle={() => setUnfolded((was) => !was)}
                />
              )}
            </span>
          )
        }
      />

      <Collapsible open={!folded} appear={false}>
        <div className="pt-1.5">
          <ProposedMemoryFacts
            memory={memory}
            editing={editing}
            pending={pending}
            body={body}
            bodyId={bodyId}
            onBody={setBody}
          />
        </div>
      </Collapsible>

      <RetirementLapsedNote inactive={lapsedRetirementsOf(memory)} />

      <Collapsible open={open} appear={false}>
        <div className="pt-3">
          <ProposedMemoryControls
            position={position}
            pending={pending}
            editing={editing}
            ready={ready}
            bodyId={bodyId}
            onApprove={
              approvable(memory)
                ? () => {
                    decided();
                    onApprove(
                      editing && written !== memory.body ? written : undefined,
                    );
                  }
                : undefined
            }
            onReject={
              open
                ? () => {
                    decided();
                    onReject();
                  }
                : undefined
            }
            onCancel={() => {
              setBody(memory.body);
              setEditing(false);
            }}
          />
        </div>
      </Collapsible>
    </DecisionCard>
  );
}
