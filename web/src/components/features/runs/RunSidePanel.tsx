import { type ReactNode, useMemo, useState } from 'react';
import { ChangeDetail } from '@/components/features/runs/ChangeDetail';
import { RememberedDetail } from '@/components/features/runs/remembered/RememberedDetail';
import { useLingering } from '@/hooks/useLingering';
import type { FileChange, LineRange } from '@/lib/changes';
import { type RememberedRun, RunSidePanelContext } from '@/lib/run-side-panel';

const LEAVING = 240;

type Showing =
  | {
      readonly kind: 'change';
      readonly file: FileChange;
      readonly lines: LineRange | null;
    }
  | { readonly kind: 'remembered'; readonly run: RememberedRun };

export function RunSidePanel({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState<Showing | null>(null);
  const held = useLingering(showing, LEAVING);

  const value = useMemo(
    () => ({
      selected: showing?.kind === 'change' ? showing.file : null,
      lines: showing?.kind === 'change' ? showing.lines : null,
      remembered: showing?.kind === 'remembered' ? showing.run : null,
      open: (file: FileChange, at?: LineRange) =>
        setShowing({ kind: 'change', file, lines: at ?? null }),
      openRemembered: (run: RememberedRun) =>
        setShowing({ kind: 'remembered', run }),
      close: () => setShowing(null),
    }),
    [showing],
  );

  return (
    <RunSidePanelContext value={value}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>

        {held?.kind === 'change' && (
          <ChangeDetail
            key="change"
            file={held.file}
            lines={held.lines}
            open={showing === held}
            onClose={() => setShowing(null)}
          />
        )}

        {held?.kind === 'remembered' && (
          <RememberedDetail
            key="remembered"
            {...held.run}
            open={showing === held}
            onClose={() => setShowing(null)}
          />
        )}
      </div>
    </RunSidePanelContext>
  );
}
