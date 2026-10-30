import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import type { InboxDrop } from '@/hooks/useInboxDrag';
import { cn } from '@/lib/utils';

type InboxDropZoneProps = {
  id: InboxDrop;
  className?: string;
  children: ReactNode;
};

export function InboxDropZone({ id, className, children }: InboxDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      data-over={isOver || undefined}
      className={cn(
        'rounded-md transition-colors data-over:bg-accent data-over:ring-1 data-over:ring-border',
        className,
      )}
    >
      {children}
    </div>
  );
}
