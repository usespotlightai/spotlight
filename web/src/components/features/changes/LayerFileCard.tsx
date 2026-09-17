import { ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { FileNote } from '@/components/features/changes/FileNote';
import { HunkReview } from '@/components/features/review/HunkReview';
import { DiffTally } from '@/components/shared/DiffTally';
import { Unfold } from '@/components/shared/Unfold';
import { Button } from '@/components/ui/button';
import { useDiffGutter } from '@/hooks/useDiffGutter';
import { useNearViewport } from '@/hooks/useNearViewport';
import { type LayerFile, linesOf, tallyOf } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

const LINE_HEIGHT = 17;

const HEADER_HEIGHT = 36;

const NOTE_GAP = 12;

const TOO_LARGE = 800;

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
  const card = useRef<HTMLElement>(null);
  const near = useNearViewport(card);
  const gutter = useDiffGutter(card);
  const [asked, setAsked] = useState(false);
  const lines = linesOf(hunks);
  const tooLarge = lines > TOO_LARGE;
  const shows = open && (!tooLarge || asked);
  const tall = shows ? lines * LINE_HEIGHT : 0;

  return (
    <article
      ref={card}
      aria-label={file.path}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${tall + HEADER_HEIGHT}px`,
      }}
      className="overflow-hidden rounded-lg border-[0.5px] border-border bg-card"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 border-border bg-card px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
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
        {note && <FileNote note={note} inset={gutter + NOTE_GAP} />}

        {tooLarge && !asked ? (
          <div className="flex items-center gap-3 px-3 py-3 text-xs">
            <p className="text-faint">Large files are not shown by default.</p>

            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 shrink-0 rounded-full bg-card text-xs"
              onClick={() => setAsked(true)}
            >
              Show the changes
            </Button>
          </div>
        ) : near ? (
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
        ) : (
          <div style={{ height: tall }} />
        )}
      </Unfold>
    </article>
  );
}
