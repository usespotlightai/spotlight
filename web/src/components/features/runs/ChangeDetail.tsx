import { X } from 'lucide-react';
import { CodeDiff } from '@/components/shared/CodeDiff';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { type FileChange, repoRelative, tallyFile } from '@/lib/changes';

const CHANGE_PANE: PaneConfig = {
  storageKey: 'spotlight.changes-detail-width',
  min: 288,
  max: 960,
  initial: 560,
  label: 'Resize the diff',
};

export function ChangeDetail({
  file,
  open,
  onClose,
}: {
  file: FileChange;
  open: boolean;
  onClose: () => void;
}) {
  const { added, removed } = tallyFile(file);

  return (
    <SidePane pane={CHANGE_PANE} open={open}>
      <div className="flex items-center gap-2 border-border border-b-[0.5px] px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-foreground text-xs">
          {repoRelative(file.path)}
        </p>
        {added > 0 && (
          <span className="shrink-0 text-emerald-600 text-xs tabular-nums dark:text-emerald-400">
            +{added}
          </span>
        )}
        {removed > 0 && (
          <span className="shrink-0 text-destructive text-xs tabular-nums">
            −{removed}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close diff"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
        <CodeDiff
          flush
          path={file.path}
          before={file.before}
          after={file.after}
        />
      </div>
    </SidePane>
  );
}
