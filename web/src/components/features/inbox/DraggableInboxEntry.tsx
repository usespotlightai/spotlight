import { useDraggable } from '@dnd-kit/core';
import { InboxEntryRow } from '@/components/features/inbox/InboxEntryRow';
import { entryKey, type InboxEntry, reopenable, resolvable } from '@/lib/inbox';
import { cn } from '@/lib/utils';

type DraggableInboxEntryProps = {
  slug: string;
  entry: InboxEntry;
};

export function DraggableInboxEntry({ slug, entry }: DraggableInboxEntryProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: entryKey(entry),
    disabled: !resolvable(entry) && !reopenable(entry),
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      className={cn('touch-none', isDragging && 'opacity-40')}
    >
      <InboxEntryRow slug={slug} entry={entry} />
    </li>
  );
}
