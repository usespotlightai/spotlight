import { DiffStat } from '@/components/shared/DiffStat';
import type { LocatedLayer } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type StackNavLayerProps = {
  located: LocatedLayer;
  files: number;
  tally: { added: number; removed: number };
  active: boolean;
  onPick: (layerId: string) => void;
};

export function StackNavLayer({
  located,
  files,
  tally,
  active,
  onPick,
}: StackNavLayerProps) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(located.layer.id)}
        aria-current={active ? 'step' : undefined}
        className={cn(
          'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-border/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
          active && 'bg-border hover:bg-border',
        )}
      >
        <span
          className={cn(
            'mt-px flex size-5 shrink-0 items-center justify-center rounded-full border-[0.5px] border-border bg-card font-medium text-[10px] text-muted-foreground tabular-nums',
            active && 'border-foreground/20 text-foreground',
          )}
        >
          {located.position}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'text-muted-foreground leading-5',
              active && 'font-medium text-foreground',
            )}
          >
            {located.layer.title}
          </span>
          <span className="flex items-center gap-1.5 text-faint text-xs">
            <span>
              {files} {files === 1 ? 'file' : 'files'}
            </span>
            <DiffStat added={tally.added} removed={tally.removed} />
          </span>
        </span>
      </button>
    </li>
  );
}
