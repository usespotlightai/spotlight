import { useEffect, useRef, useState } from 'react';

import {
  MEMORY_COLUMNS,
  MEMORY_DETAIL_CELL,
  MEMORY_KIND_CELL,
} from '@/components/features/memory/columns';
import { MemoryBodyCell } from '@/components/features/memory/MemoryBodyCell';
import { MemoryCellLabel } from '@/components/features/memory/MemoryCellLabel';
import { MemoryDetails } from '@/components/features/memory/MemoryDetails';
import { MemoryKindLabel } from '@/components/features/memory/MemoryKindLabel';
import { MemoryKindSelect } from '@/components/features/memory/MemoryKindSelect';
import { MemoryPlace } from '@/components/features/memory/MemoryPlace';
import { MemoryPlaceEditor } from '@/components/features/memory/MemoryPlaceEditor';
import { MemorySource } from '@/components/features/memory/MemorySource';
import { RetirementNote } from '@/components/features/memory/RetirementNote';
import { useMemoryEditing } from '@/hooks/useMemoryEditing';
import { useRowClick } from '@/hooks/useRowClick';
import { useRowExpansion } from '@/hooks/useRowExpansion';
import type { LineResponseDto } from '@/lib/api';
import { placeTreeOf, SOURCE_LABELS, type TeamMemory } from '@/lib/memory';
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
  const { row, expanded, clamped, closing, toggle } = useRowExpansion({
    open,
    onOpenChange,
  });
  const [seen, setSeen] = useState(open);
  const editing = useMemoryEditing(teamId, memory, lines, open);
  const { draft } = editing;
  const changing = editing.editing && expanded;
  const toggledHere = useRef(false);

  if (open && !seen) {
    setSeen(true);
  }

  const flip = () => {
    toggledHere.current = true;
    toggle();
  };

  useRowClick(row, flip, { ignore: () => changing });

  useEffect(() => {
    if (open && !toggledHere.current) {
      row.current?.scrollIntoView?.({ block: 'nearest' });
    }
    toggledHere.current = false;
  }, [open, row]);

  return (
    <li
      ref={row}
      data-slot="team-memory"
      data-clamped={clamped || undefined}
      data-closing={closing || undefined}
      className={cn(
        'group/row rounded-md bg-accent transition-colors data-clamped:bg-transparent data-clamped:hover:bg-accent',
        !changing && 'cursor-pointer',
      )}
    >
      <div
        className={cn(
          'relative grid min-h-9 items-start gap-3 rounded-md px-3 py-2 text-sm leading-5 @md/pane:group-data-clamped/row:h-9',
          MEMORY_COLUMNS,
        )}
      >
        <MemoryBodyCell
          body={memory.body}
          expanded={expanded}
          changing={changing}
          draft={draft}
          onToggle={flip}
          onSave={editing.save}
          onCancel={editing.cancel}
        />

        <span
          className={cn(
            'relative z-10 min-w-0 truncate text-muted-foreground text-sm leading-5',
            !changing && MEMORY_KIND_CELL,
          )}
        >
          {changing ? (
            <MemoryKindSelect value={draft.kind} onChange={draft.setKind} />
          ) : (
            <MemoryKindLabel kind={memory.kind} />
          )}
        </span>

        <span
          className={cn(
            'relative z-10 flex min-w-0 flex-col group-data-clamped/row:pointer-events-none',
            MEMORY_DETAIL_CELL,
          )}
        >
          <MemoryCellLabel>Applies to</MemoryCellLabel>
          {changing ? (
            <MemoryPlaceEditor draft={draft} lines={lines} />
          ) : (
            <MemoryPlace tree={placeTreeOf(memory, lines)} open={expanded} />
          )}
        </span>

        <div
          className={cn(
            'relative z-10 flex min-w-0 flex-col gap-2 text-muted-foreground text-sm leading-5 group-data-clamped/row:pointer-events-none',
            MEMORY_DETAIL_CELL,
          )}
        >
          <span className="flex min-w-0 flex-col">
            <MemoryCellLabel>Source</MemoryCellLabel>
            <span className="truncate">{SOURCE_LABELS[memory.source]}</span>
          </span>
          {seen && (
            <div className="group-data-clamped/row:hidden">
              <MemorySource slug={slug} teamId={teamId} memoryId={memory.id} />
            </div>
          )}
        </div>

        <span
          className={cn(
            'flex min-w-0 flex-col text-muted-foreground text-sm leading-5',
            MEMORY_DETAIL_CELL,
          )}
        >
          <MemoryCellLabel>Approved by</MemoryCellLabel>
          <span className="truncate">
            {memory.approvedBy.name ?? 'Someone'}
          </span>
        </span>

        <span
          className={cn(
            'flex min-w-0 flex-col text-muted-foreground text-sm leading-5 tabular-nums @4xl/pane:text-right',
            MEMORY_DETAIL_CELL,
          )}
        >
          <MemoryCellLabel>Runs</MemoryCellLabel>
          <span className="truncate">{memory.runs}</span>
        </span>
      </div>

      {seen && (
        <div className="relative z-10 flex flex-col gap-3 px-3 pb-3 text-sm group-data-clamped/row:hidden">
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
            saving={editing.saving}
            unsaveable={editing.unsaveable}
            onEdit={editing.start}
            onCancel={editing.cancel}
            onSave={editing.save}
          />
        </div>
      )}
    </li>
  );
}
