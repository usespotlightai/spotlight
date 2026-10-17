import { Button } from '@/components/ui/button';
import { formatTitle, type ReplayableRun } from '@/lib/replay';
import { formatRunState, formatUnreplayableReason } from '@/lib/replay-words';
import { since } from '@/lib/since';

type ReplayableRunRowProps = {
  run: ReplayableRun;
  note?: string;
  inSet: boolean;
  adding: boolean;
  onAdd: () => void;
};

export function ReplayableRunRow({
  run,
  note,
  inSet,
  adding,
  onAdd,
}: ReplayableRunRowProps) {
  return (
    <li
      data-slot="replayable-run"
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-foreground">
          {formatTitle(run.title)}
        </span>
        <span className="flex flex-wrap gap-x-1.5 text-muted-foreground text-xs">
          <span>{formatRunState(run.state)}</span>
          {note && <span>· {note}</span>}
          <span>· ended {since(run.endedAt)}</span>
          {run.unreplayableReason && (
            <span className="text-destructive">
              · {formatUnreplayableReason(run.unreplayableReason)}
            </span>
          )}
        </span>
      </div>

      {inSet ? (
        <span className="shrink-0 text-muted-foreground text-xs">
          In the set
        </span>
      ) : run.unreplayableReason ? (
        <span className="shrink-0 text-muted-foreground text-xs">
          Can’t be replayed
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full bg-card shadow-none"
          aria-label={`Add ${formatTitle(run.title)}`}
          disabled={adding}
          onClick={onAdd}
        >
          {adding ? 'Adding…' : 'Add'}
        </Button>
      )}
    </li>
  );
}
