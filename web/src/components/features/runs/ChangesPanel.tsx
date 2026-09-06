import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ChangeDetail } from '@/components/features/runs/ChangeDetail';
import type { FileChange } from '@/lib/changes';
import { ChangesPanelContext } from '@/lib/changes-panel';

// Matches the pane's close animation so it stays mounted until that finishes.
const LEAVING = 240;

export function ChangesPanel({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<FileChange | null>(null);
  const [held, setHeld] = useState<FileChange | null>(null);

  useEffect(() => {
    if (selected) {
      setHeld(selected);
      return;
    }

    if (held === null) {
      return;
    }

    const timer = setTimeout(() => setHeld(null), LEAVING);
    return () => clearTimeout(timer);
  }, [selected, held]);

  const value = useMemo(
    () => ({
      selected,
      open: (file: FileChange) => setSelected(file),
      close: () => setSelected(null),
    }),
    [selected],
  );

  return (
    <ChangesPanelContext value={value}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>

        {held && (
          <ChangeDetail
            file={held}
            open={selected !== null}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </ChangesPanelContext>
  );
}
