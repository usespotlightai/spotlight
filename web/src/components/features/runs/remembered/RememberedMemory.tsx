import { ThisWasWrong } from '@/components/features/runs/remembered/ThisWasWrong';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  KIND_LABELS,
  memoryPath,
  retiredAs,
  type TeamMemory,
} from '@/lib/memory';

type RememberedMemoryProps = {
  slug: string;
  teamId: string;
  memory: TeamMemory;
  cut?: boolean;
};

export function RememberedMemory({
  slug,
  teamId,
  memory,
  cut = false,
}: RememberedMemoryProps) {
  return (
    <li
      data-slot="remembered-memory"
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
        <TrailLink
          to={memoryPath(slug, teamId, memory.id)}
          className="font-mono text-foreground underline-offset-4 hover:underline"
        >
          {memory.handle}
        </TrailLink>
        <Pill className="px-1.5 py-0">
          {KIND_LABELS[memory.kind] ?? memory.kind}
        </Pill>
        {cut && <Pill className="px-1.5 py-0">Cut by the cap</Pill>}
        <span className="flex-1" />
        {memory.standing === 'stands' && (
          <ThisWasWrong teamId={teamId} memoryId={memory.id} />
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-6">
        {memory.body}
      </p>
      {memory.retirement && (
        <p className="text-muted-foreground text-xs leading-5">
          {retiredAs(memory.retirement)}
        </p>
      )}
    </li>
  );
}
