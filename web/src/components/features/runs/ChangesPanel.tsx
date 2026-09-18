import { type ReactNode, useMemo, useState } from 'react';
import { ChangeDetail } from '@/components/features/runs/ChangeDetail';
import { useLingering } from '@/hooks/useLingering';
import type { FileChange } from '@/lib/changes';
import { ChangesPanelContext } from '@/lib/changes-panel';

const LEAVING = 240;

export function ChangesPanel({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<FileChange | null>(null);
  const held = useLingering(selected, LEAVING);

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
