import { DragOverlay } from '@dnd-kit/core';
import { InboxEntryRow } from '@/components/features/inbox/InboxEntryRow';
import type { InboxEntry } from '@/lib/inbox';

type InboxDragOverlayProps = {
  slug: string;
  entry: InboxEntry | null;
};

export function InboxDragOverlay({ slug, entry }: InboxDragOverlayProps) {
  return (
    <DragOverlay dropAnimation={null}>
      {entry && (
        <div className="cursor-grabbing rounded-md bg-card shadow-md ring-1 ring-border">
          <InboxEntryRow slug={slug} entry={entry} />
        </div>
      )}
    </DragOverlay>
  );
}
