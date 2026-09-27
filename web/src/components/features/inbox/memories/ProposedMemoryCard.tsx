import { TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { MemoryGrounds } from '@/components/features/memory/MemoryGrounds';
import { Composer } from '@/components/shared/form/Composer';
import { Pill } from '@/components/shared/Pill';
import { Button } from '@/components/ui/button';
import {
  decidedBy,
  fromOutside,
  KIND_LABELS,
  MOST_MEMORY_BODY,
  type ProposedMemory,
  reachOf,
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
  const [editing, setEditing] = useState(false);
  const outside = fromOutside(memory);
  const settled = decidedBy(memory);
  const bodyId = useId();

  return (
    <li
      data-slot="proposed-memory"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-3"
    >
      <div className="flex items-center gap-2">
        <Pill className="px-1.5 py-0">
          {KIND_LABELS[memory.kind] ?? memory.kind}
        </Pill>
        <p className="min-w-0 truncate text-muted-foreground text-xs">
          {reachOf(memory)}
        </p>
      </div>

      {outside && (
        <p
          role="note"
          data-slot="outside-warning"
          className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-amber-700 text-xs leading-5 dark:text-amber-300"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          It rests on work from outside the team. Read what it rests on before
          you approve it; it is approved on its own.
        </p>
      )}

      {editing && undecided(memory) ? (
        <Composer
          label="The memory as it should stand"
          submitLabel="Approve as edited"
          placeholder="What the team should remember"
          most={MOST_MEMORY_BODY}
          initial={memory.body}
          pending={pending}
          failed={failed}
          onSubmit={(body) => onApprove(body)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <p
          id={bodyId}
          className="whitespace-pre-wrap break-words text-foreground text-sm leading-6"
        >
          {memory.body}
        </p>
      )}

      <MemoryGrounds grounds={memory} startsOpen={outside} />

      {settled ? (
        <p className="text-muted-foreground text-sm leading-6">{settled}</p>
      ) : (
        !editing &&
        undecided(memory) && (
          <div className="flex flex-col gap-2">
            {failed && (
              <p role="alert" className="text-destructive text-xs">
                It could not be saved. Try again.
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() => onApprove()}
                aria-label={`Approve memory ${position}`}
                aria-describedby={bodyId}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setEditing(true)}
                aria-label={`Edit memory ${position}`}
                aria-describedby={bodyId}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={onReject}
                aria-label={`Reject memory ${position}`}
                aria-describedby={bodyId}
              >
                Reject
              </Button>
            </div>
          </div>
        )
      )}
    </li>
  );
}
