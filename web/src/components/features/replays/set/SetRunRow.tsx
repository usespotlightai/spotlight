import { X } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button } from '@/components/ui/button';
import { useRemoveReplaySetEntry } from '@/hooks/api/useRemoveReplaySetEntry';
import {
  type ReplayedStation,
  type ReplaySetEntry,
  titleShown,
} from '@/lib/replay';
import { replayableShown, runStateShown } from '@/lib/replay-words';
import { runPath } from '@/lib/run';
import { since } from '@/lib/runner';
import { cn } from '@/lib/utils';

type SetRunRowProps = {
  at: ReplayedStation;
  setId: string;
  entry: ReplaySetEntry;
  frozen: boolean;
};

export function SetRunRow({ at, setId, entry, frozen }: SetRunRowProps) {
  const remove = useRemoveReplaySetEntry();
  const title = titleShown(entry.title);

  return (
    <li
      data-slot="set-run"
      className="flex flex-col gap-0.5 rounded-md px-2 py-2 text-sm"
    >
      <div className="flex min-w-0 items-center gap-2">
        <TrailLink
          to={runPath(at.slug, at.teamId, entry.runId)}
          className="min-w-0 truncate text-foreground underline-offset-2 hover:underline"
        >
          {title}
        </TrailLink>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ml-auto shrink-0"
          aria-label={`Take ${title} out of the set`}
          disabled={remove.isPending || frozen}
          onClick={() =>
            remove.mutate({ teamId: at.teamId, setId, runId: entry.runId })
          }
        >
          <X aria-hidden />
        </Button>
      </div>

      <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
        <span>{entry.state ? runStateShown(entry.state) : 'Unknown run'}</span>
        {entry.endedAt && <span>· ended {since(entry.endedAt)}</span>}
        <span>·</span>
        <span className={cn(entry.refusal && 'text-destructive')}>
          {replayableShown(entry.refusal)}
        </span>
      </p>
    </li>
  );
}
