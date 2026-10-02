import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { MemoryDetails } from '@/components/features/memory/MemoryDetails';
import { Pill } from '@/components/shared/Pill';
import { Unfold } from '@/components/shared/Unfold';
import type { LineResponseDto } from '@/lib/api';
import {
  KIND_LABELS,
  placeOf,
  retiredAs,
  SOURCE_LABELS,
  type TeamMemory,
  usedBy,
} from '@/lib/memory';
import { cn } from '@/lib/utils';

type TeamMemoryRowProps = {
  slug: string;
  teamId: string;
  memory: TeamMemory;
  lines: readonly LineResponseDto[];
  startsOpen?: boolean;
};

export function TeamMemoryRow({
  slug,
  teamId,
  memory,
  lines,
  startsOpen = false,
}: TeamMemoryRowProps) {
  const [open, setOpen] = useState(startsOpen);
  const [seen, setSeen] = useState(startsOpen);

  return (
    <li
      data-slot="team-memory"
      className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-3"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setSeen(true);
          setOpen((was) => !was);
        }}
        className="flex w-full items-start gap-3 text-left outline-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="block whitespace-pre-wrap break-words text-foreground text-sm leading-6">
            {memory.body}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
            <span className="font-mono">{memory.handle}</span>
            <Pill className="px-1.5 py-0">{KIND_LABELS[memory.kind]}</Pill>
            <span className="truncate">{placeOf(memory, lines)}</span>
            <span aria-hidden>·</span>
            <span>
              {SOURCE_LABELS[memory.source]}, kept by{' '}
              {memory.approvedBy.name ?? 'someone'}
            </span>
            <span aria-hidden>·</span>
            <span>{usedBy(memory.runs)}</span>
          </span>
          {memory.retirement && (
            <span className="block text-muted-foreground text-xs leading-5">
              {retiredAs(memory.retirement)}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'mt-1.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <Unfold open={open} appear={false}>
        {seen && (
          <MemoryDetails
            slug={slug}
            teamId={teamId}
            memoryId={memory.id}
            lines={lines}
          />
        )}
      </Unfold>
    </li>
  );
}
