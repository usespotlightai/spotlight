import { useDroppable } from '@dnd-kit/core';
import { use } from 'react';

import { TabDragContext, zoneId } from '@/components/shell/tabs/tab-drag';
import type { SplitSide } from '@/lib/app-tabs';
import { cn } from '@/lib/utils';

type SplitDropZonesProps = {
  sides: readonly SplitSide[];
};

export function SplitDropZones({ sides }: SplitDropZonesProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 flex">
      {sides.map((side) => (
        <SplitDropZone key={side} side={side} />
      ))}
    </div>
  );
}

function SplitDropZone({ side }: { side: SplitSide }) {
  const { draggedId, overSide, accepts } = use(TabDragContext);
  const { setNodeRef } = useDroppable({
    id: zoneId(side),
    disabled: !accepts(side),
  });

  return (
    <div
      ref={setNodeRef}
      data-slot="split-drop-zone"
      className="relative flex-1"
    >
      <div
        className={cn(
          'absolute inset-1.5 rounded-md bg-card/70 ring-[0.5px] ring-border shadow-pane backdrop-blur-[2px] transition-opacity duration-150',
          draggedId && overSide === side ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
