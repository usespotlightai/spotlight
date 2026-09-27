import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Unfold } from '@/components/shared/Unfold';
import type { ProposedMemory } from '@/lib/memory';
import { cn } from '@/lib/utils';

type MemoryGroundsProps = {
  memory: ProposedMemory;
  startsOpen: boolean;
};

const SPOKEN_BY: Record<string, string> = {
  person: 'A teammate said',
  world: 'Someone outside Spotlight said',
};

export function MemoryGrounds({ memory, startsOpen }: MemoryGroundsProps) {
  const [open, setOpen] = useState(startsOpen);
  const cited = memory.steps.length + memory.notes.length;

  if (cited === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="flex items-center gap-1 self-start text-muted-foreground text-xs outline-none hover:text-foreground"
      >
        What it rests on
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <Unfold open={open} appear={false}>
        <ol className="flex flex-col gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2">
          {memory.notes.map((note) => (
            <li key={`note-${note.position}`} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">
                {SPOKEN_BY[note.by] ?? 'Someone said'}
              </span>
              <p className="whitespace-pre-wrap break-words text-foreground text-xs leading-5">
                {note.text}
              </p>
            </li>
          ))}
          {memory.steps.map((step) => (
            <li key={`step-${step.index}`} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">
                The agent {step.kind === 'handover' ? 'handed over' : step.kind}
              </span>
              <p className="whitespace-pre-wrap break-words text-foreground text-xs leading-5">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </Unfold>
    </div>
  );
}
