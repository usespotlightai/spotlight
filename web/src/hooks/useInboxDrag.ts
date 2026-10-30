import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useReopenInboxEntry } from '@/hooks/api/useReopenInboxEntry';
import { useResolveInboxEntry } from '@/hooks/api/useResolveInboxEntry';
import { useDragGuard } from '@/hooks/useDragGuard';
import { entryKey, type InboxEntry, reopenable, resolvable } from '@/lib/inbox';

const HOLD = 6;

export const OPEN_DROP = 'open';
export const RESOLVED_DROP = 'resolved';

export type InboxDrop = typeof OPEN_DROP | typeof RESOLVED_DROP;

export function useInboxDrag(
  slug: string | undefined,
  entries: readonly InboxEntry[],
) {
  const resolve = useResolveInboxEntry();
  const reopen = useReopenInboxEntry();
  const swallowNextClick = useDragGuard();
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: HOLD } }),
  );

  const dragged = entries.find((each) => entryKey(each) === draggedKey) ?? null;

  const drop = ({ active, over }: DragEndEvent) => {
    const entry = entries.find((each) => entryKey(each) === active.id);

    if (!slug || !entry) {
      return;
    }
    if (over?.id === RESOLVED_DROP && resolvable(entry)) {
      resolve.mutate({ slug, entry });
    }
    if (over?.id === OPEN_DROP && reopenable(entry)) {
      reopen.mutate({ slug, entry });
    }
  };

  return {
    sensors,
    dragged,
    handlers: {
      onDragStart: ({ active }: DragStartEvent) =>
        setDraggedKey(String(active.id)),
      onDragCancel: () => {
        setDraggedKey(null);
        swallowNextClick();
      },
      onDragEnd: (event: DragEndEvent) => {
        setDraggedKey(null);
        swallowNextClick();
        drop(event);
      },
    },
  };
}
