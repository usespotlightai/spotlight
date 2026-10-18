import { ChevronRight, MessageSquarePlus } from 'lucide-react';
import { DiffStat } from '@/components/shared/DiffStat';
import { Button } from '@/components/ui/button';
import type { LayerFile } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

const STATUS: Record<LayerFile['file']['status'], string | null> = {
  added: 'Added',
  deleted: 'Deleted',
  renamed: 'Renamed',
  modified: null,
};

type LayerFileHeaderProps = {
  file: LayerFile['file'];
  tally: { added: number; removed: number };
  open: boolean;
  onToggle: () => void;
  onComment?: () => void;
};

export function LayerFileHeader({
  file,
  tally,
  open,
  onToggle,
  onComment,
}: LayerFileHeaderProps) {
  const status = STATUS[file.status];

  return (
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
        {onComment && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Comment on this file"
            className="text-muted-foreground"
            onClick={onComment}
          >
            <MessageSquarePlus aria-hidden />
          </Button>
        )}

        <DiffStat
          added={tally.added}
          removed={tally.removed}
          className="h-6 text-xs leading-none"
        />
      </div>
    </div>
  );
}
