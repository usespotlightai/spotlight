import { type ReactNode, useMemo, useState } from 'react';
import { ChangeDetail } from '@/components/features/runs/ChangeDetail';
import { RunMemoriesDetail } from '@/components/features/runs/memories/RunMemoriesDetail';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import type { FileChange, LineRange } from '@/lib/changes';
import { type MemoriesRun, RunSidePanelContext } from '@/lib/run-side-panel';

const LEAVING = 240;

type Showing =
  | {
      readonly kind: 'change';
      readonly file: FileChange;
      readonly lines: LineRange | null;
    }
  | { readonly kind: 'memories'; readonly run: MemoriesRun };

export function RunSidePanel({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState<Showing | null>(null);
  const displayed = useDelayedValue(showing, LEAVING);

  const value = useMemo(() => {
    const sidePanel =
      displayed?.kind === 'change' ? (
        <ChangeDetail
          key="change"
          file={displayed.file}
          lines={displayed.lines}
          open={showing === displayed}
          onClose={() => setShowing(null)}
        />
      ) : displayed?.kind === 'memories' ? (
        <RunMemoriesDetail
          key="memories"
          {...displayed.run}
          open={showing === displayed}
          onClose={() => setShowing(null)}
        />
      ) : null;

    return {
      selected: showing?.kind === 'change' ? showing.file : null,
      lines: showing?.kind === 'change' ? showing.lines : null,
      memories: showing?.kind === 'memories' ? showing.run : null,
      sidePanel,
      open: (file: FileChange, at?: LineRange) =>
        setShowing({ kind: 'change', file, lines: at ?? null }),
      openMemories: (run: MemoriesRun) => setShowing({ kind: 'memories', run }),
      close: () => setShowing(null),
    };
  }, [showing, displayed]);

  return (
    <RunSidePanelContext value={value}>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </RunSidePanelContext>
  );
}
