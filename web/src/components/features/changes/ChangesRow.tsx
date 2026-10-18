import { CircleDashed, FileDiff } from 'lucide-react';
import { DiffTally } from '@/components/shared/DiffTally';
import { TrailLink } from '@/components/shell/layout/TrailLink';

type ChangesRowProps = {
  to: string;
  generating: boolean;
  added: number;
  removed: number;
};

export function ChangesRow({
  to,
  generating,
  added,
  removed,
}: ChangesRowProps) {
  const Icon = generating ? CircleDashed : FileDiff;

  return (
    <TrailLink
      to={to}
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />

      <span className="truncate text-foreground">Changes</span>

      <DiffTally added={added} removed={removed} className="ml-auto text-xs" />
    </TrailLink>
  );
}
