import { ChevronRight } from 'lucide-react';
import { HunkReview } from '@/components/features/review/HunkReview';
import { DiffTally } from '@/components/shared/DiffTally';
import { Unfold } from '@/components/shared/Unfold';
import { type LayerFile, tallyOf } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

const STATUS: Record<LayerFile['file']['status'], string | null> = {
  added: 'Added',
  deleted: 'Deleted',
  renamed: 'Renamed',
  modified: null,
};

type LayerFileCardProps = {
  placed: LayerFile;
  open: boolean;
  onToggle: () => void;
};

export function LayerFileCard({ placed, open, onToggle }: LayerFileCardProps) {
  const { file, hunks } = placed;
  const tally = tallyOf(hunks.map((each) => each.hunk));
  const status = STATUS[file.status];

  return (
    <article
      aria-label={file.path}
      className="overflow-hidden rounded-lg border-[0.5px] border-border bg-card"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 border-border bg-muted/40 px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
          open && 'border-b-[0.5px]',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
        <span className="min-w-0 truncate font-medium text-foreground">
          {file.previousPath && (
            <span className="text-muted-foreground">
              {file.previousPath} →{' '}
            </span>
          )}
          {file.path}
        </span>

        {status && <span className="shrink-0 text-faint">{status}</span>}

        <DiffTally
          added={tally.added}
          removed={tally.removed}
          className="ml-auto"
        />
      </button>

      <Unfold open={open} appear={false}>
        <ol className="flex flex-col divide-y-[0.5px] divide-border">
          {hunks.map(({ hunk, summary }) => (
            <li key={hunk.id} className="flex flex-col">
              {summary && (
                <p className="border-border border-b-[0.5px] px-3 py-2 text-muted-foreground text-xs">
                  {summary}
                </p>
              )}

              {hunk.patch ? (
                <HunkReview file={file} hunk={hunk} />
              ) : (
                <p className="px-3 py-2 text-faint text-xs">
                  {file.binary
                    ? 'A binary file, with no lines to show.'
                    : 'No lines changed.'}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Unfold>
    </article>
  );
}
