import { ChevronRight, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { FileThread } from '@/components/features/changes/FileThread';
import { FileDecisions } from '@/components/features/decisions/FileDecisions';
import { HunkReview } from '@/components/features/review/HunkReview';
import { DiffTally } from '@/components/shared/DiffTally';
import { UNFOLD_MS, Unfold } from '@/components/shared/Unfold';
import { Button } from '@/components/ui/button';
import { useLingering } from '@/hooks/useLingering';
import { type LayerFile, tallyOf } from '@/lib/change-stack';
import { useReviewing } from '@/lib/review-context';
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
  const { file, hunks, note } = placed;
  const tally = tallyOf(hunks);
  const status = STATUS[file.status];
  const [replying, setReplying] = useState(false);
  const reviewing = useReviewing();
  const mounted = useLingering(open || null, UNFOLD_MS) !== null;

  return (
    <article
      aria-label={file.path}
      className="overflow-hidden rounded-lg border-[0.5px] border-border bg-card"
    >
      <div
        className={cn(
          'flex items-center border-border bg-card transition-colors hover:bg-muted/40',
          open && 'border-b-[0.5px]',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
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
        </button>

        <div className="flex shrink-0 items-center gap-1 pr-3">
          {reviewing && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Comment on this file"
              className="text-muted-foreground"
              onClick={() => {
                if (!open) {
                  onToggle();
                }
                setReplying(true);
              }}
            >
              <MessageSquarePlus aria-hidden />
            </Button>
          )}

          <DiffTally
            added={tally.added}
            removed={tally.removed}
            className="h-6 text-xs leading-none"
          />
        </div>
      </div>

      <Unfold open={open} appear={false}>
        <FileThread
          path={file.path}
          note={note}
          replying={replying}
          onReplying={setReplying}
        />

        <FileDecisions path={file.path} />

        {mounted && (
          <ol className="flex flex-col divide-y-[0.5px] divide-border">
            {hunks.map((hunk) => (
              <li key={hunk.id} className="flex flex-col">
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
        )}
      </Unfold>
    </article>
  );
}
