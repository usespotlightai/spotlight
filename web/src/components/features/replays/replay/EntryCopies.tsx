import { EntryResult } from '@/components/features/replays/replay/EntryResult';
import { copiesTally, type ReplayEntry } from '@/lib/replay';
import { copiesSucceededShown, copyShown } from '@/lib/replay-words';

type EntryCopiesProps = {
  copies: readonly ReplayEntry[];
  runTo: (runId: string | null) => string | null;
};

export function EntryCopies({ copies, runTo }: EntryCopiesProps) {
  const [only] = copies;

  if (copies.length === 1 && only) {
    return <EntryResult entry={only} runTo={runTo(only.runId)} />;
  }

  const { succeeded, scored } = copiesTally(copies);

  return (
    <span data-slot="entry-copies" className="flex min-w-0 flex-col gap-1">
      <span className="font-medium text-foreground tabular-nums">
        {copiesSucceededShown(succeeded, scored)}
      </span>
      <ol className="flex flex-col gap-1">
        {copies.map((copy) => (
          <li
            key={copy.repeat}
            data-slot="entry-copy"
            className="flex min-w-0 items-baseline gap-1.5"
          >
            <span className="shrink-0 text-muted-foreground">
              {copyShown(copy.repeat)}
            </span>
            <EntryResult entry={copy} runTo={runTo(copy.runId)} />
          </li>
        ))}
      </ol>
    </span>
  );
}
