import { MEMORY_COLUMNS } from '@/components/features/memory/columns';
import { MemoryBodyInput } from '@/components/features/memory/MemoryBodyInput';
import { MemoryKindSelect } from '@/components/features/memory/MemoryKindSelect';
import { MemoryPlaceEditor } from '@/components/features/memory/MemoryPlaceEditor';
import { PillButton } from '@/components/shared/PillButton';
import { useSession } from '@/hooks/api/useSession';
import { useWriteMemory } from '@/hooks/api/useWriteMemory';
import { useMemoryDraft } from '@/hooks/useMemoryDraft';
import type { LineResponseDto } from '@/lib/api';
import { SOURCE_SHOWN } from '@/lib/memory';
import { cn } from '@/lib/utils';

type NewMemoryRowProps = {
  teamId: string;
  lines: readonly LineResponseDto[];
  onDone: () => void;
};

export function NewMemoryRow({ teamId, lines, onDone }: NewMemoryRowProps) {
  const draft = useMemoryDraft(null, lines);
  const write = useWriteMemory();
  const { data: session } = useSession();
  const unsaveable = draft.empty || write.isPending;

  const save = () => {
    if (!unsaveable) {
      write.mutate({ teamId, memory: draft.written() }, { onSuccess: onDone });
    }
  };

  return (
    <li
      data-slot="new-memory"
      aria-label="Write a memory"
      className="rounded-md bg-accent"
    >
      <div
        className={cn(
          'grid min-h-9 items-start gap-3 px-3 py-2 text-sm leading-5',
          MEMORY_COLUMNS,
        )}
      >
        <MemoryBodyInput
          value={draft.body}
          onChange={draft.setBody}
          onSave={save}
          onCancel={onDone}
        />
        <MemoryKindSelect value={draft.kind} onChange={draft.setKind} />
        <MemoryPlaceEditor draft={draft} lines={lines} />
        <span className="truncate text-muted-foreground text-xs leading-5">
          {SOURCE_SHOWN.person}
        </span>
        <span className="truncate text-muted-foreground text-xs leading-5">
          {session?.user.name ?? 'You'}
        </span>
        <span className="text-right text-muted-foreground text-xs leading-5 tabular-nums">
          0
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 pt-1 pb-3">
        <PillButton
          type="button"
          variant="default"
          disabled={unsaveable}
          onClick={save}
        >
          {write.isPending ? 'Saving…' : 'Save'}
        </PillButton>
        <PillButton type="button" onClick={onDone}>
          Cancel
        </PillButton>
      </div>
    </li>
  );
}
