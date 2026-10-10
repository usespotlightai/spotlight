import { useEffect, useRef, useState } from 'react';
import { MEMORY_COLUMNS } from '@/components/features/memory/columns';
import { MemoryBodyInput } from '@/components/features/memory/MemoryBodyInput';
import { MemoryDetails } from '@/components/features/memory/MemoryDetails';
import { MemoryKindLabel } from '@/components/features/memory/MemoryKindLabel';
import { MemoryKindSelect } from '@/components/features/memory/MemoryKindSelect';
import { MemoryPlace } from '@/components/features/memory/MemoryPlace';
import { MemoryPlaceEditor } from '@/components/features/memory/MemoryPlaceEditor';
import { MemorySource } from '@/components/features/memory/MemorySource';
import { RetirementNote } from '@/components/features/memory/RetirementNote';
import { useEditMemory } from '@/hooks/api/useEditMemory';
import { useMemoryDraft } from '@/hooks/useMemoryDraft';
import { useRowClick } from '@/hooks/useRowClick';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import type { LineResponseDto } from '@/lib/api';
import { placeTreeOf, SOURCE_SHOWN, type TeamMemory } from '@/lib/memory';
import { cn } from '@/lib/utils';

type TeamMemoryRowProps = {
  slug: string;
  teamId: string;
  memory: TeamMemory;
  lines: readonly LineResponseDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TeamMemoryRow({
  slug,
  teamId,
  memory,
  lines,
  open,
  onOpenChange,
}: TeamMemoryRowProps) {
  const { row, expanded, clamped, toggle } = useRowExpansion({
    open,
    onOpenChange,
  });
  const [seen, setSeen] = useState(open);
  const [editing, setEditing] = useState(false);
  const draft = useMemoryDraft(memory, lines);
  const edit = useEditMemory();
  const changing = editing && expanded;
  const unsaveable = draft.empty || edit.isPending;
  const toggledHere = useRef(false);

  if (open && !seen) {
    setSeen(true);
  }

  if (!open && editing) {
    setEditing(false);
  }

  const startEditing = () => {
    draft.reset(memory);
    edit.reset();
    setEditing(true);
  };

  const save = () => {
    if (!unsaveable) {
      edit.mutate(
        { teamId, memoryId: memory.id, memory: draft.written() },
        { onSuccess: () => setEditing(false) },
      );
    }
  };

  const flip = () => {
    toggledHere.current = true;
    toggle();
  };

  const onRowClick = useRowClick(flip, { ignore: () => changing });

  useEffect(() => {
    if (open && !toggledHere.current) {
      row.current?.scrollIntoView?.({ block: 'nearest' });
    }
    toggledHere.current = false;
  }, [open, row]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the memory's own button is the keyboard path; this widens the click to the whole row
    <li
      ref={row}
      data-slot="team-memory"
      data-clamped={clamped || undefined}
      onClick={onRowClick}
      className={cn(
        'group/row rounded-md bg-accent transition-colors data-clamped:bg-transparent data-clamped:hover:bg-accent',
        !changing && 'cursor-pointer',
      )}
    >
      <div
        className={cn(
          'relative grid min-h-9 items-start gap-3 rounded-md px-3 py-2 text-sm leading-5 group-data-clamped/row:h-9',
          MEMORY_COLUMNS,
        )}
      >
        {changing ? (
          <MemoryBodyInput
            value={draft.body}
            onChange={draft.setBody}
            onSave={save}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={flip}
            className="min-w-0 whitespace-pre-wrap break-words text-left text-foreground leading-5 outline-none after:absolute after:inset-0 after:rounded-md focus-visible:underline group-data-clamped/row:truncate"
          >
            {memory.body}
          </button>
        )}

        <span className="relative z-10 min-w-0 truncate text-muted-foreground text-xs leading-5">
          {changing ? (
            <MemoryKindSelect value={draft.kind} onChange={draft.setKind} />
          ) : (
            <MemoryKindLabel kind={memory.kind} />
          )}
        </span>

        <span className="relative z-10 min-w-0 group-data-clamped/row:pointer-events-none">
          {changing ? (
            <MemoryPlaceEditor draft={draft} lines={lines} />
          ) : (
            <MemoryPlace tree={placeTreeOf(memory, lines)} open={expanded} />
          )}
        </span>

        <div className="relative z-10 flex min-w-0 flex-col gap-2 text-muted-foreground text-xs leading-5 group-data-clamped/row:pointer-events-none">
          <span className="truncate">{SOURCE_SHOWN[memory.source]}</span>
          {seen && (
            <div className="group-data-clamped/row:hidden">
              <MemorySource slug={slug} teamId={teamId} memoryId={memory.id} />
            </div>
          )}
        </div>

        <span className="min-w-0 truncate text-muted-foreground text-xs leading-5">
          {memory.approvedBy.name ?? 'Someone'}
        </span>

        <span className="truncate text-right text-muted-foreground text-xs leading-5 tabular-nums">
          {memory.runs}
        </span>
      </div>

      {seen && (
        <div className="relative z-10 flex flex-col gap-3 px-3 pb-3 text-xs group-data-clamped/row:hidden">
          {memory.retirement && (
            <div className="text-muted-foreground leading-5">
              <RetirementNote retirement={memory.retirement} />
            </div>
          )}
          <MemoryDetails
            teamId={teamId}
            memoryId={memory.id}
            open={open}
            editing={changing}
            saving={edit.isPending}
            unsaveable={unsaveable}
            onEdit={startEditing}
            onCancel={() => setEditing(false)}
            onSave={save}
          />
        </div>
      )}
    </li>
  );
}
