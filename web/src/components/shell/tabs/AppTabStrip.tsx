import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { TAB_SLIDE } from '@/components/shell/tabs/app-tab-look';
import { AppTabGhost } from '@/components/shell/tabs/AppTabGhost';
import { AppTabItem } from '@/components/shell/tabs/AppTabItem';
import { Button } from '@/components/ui/button';
import { type AppTab, tabIconOf } from '@/lib/app-tabs';

type AppTabStripProps = {
  tabs: readonly AppTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onMove: (id: string, to: string) => void;
  onOpen: () => void;
};

const DRAG_AFTER_PX = 4;

const alongTheStrip: Modifier = ({ transform }) => ({ ...transform, y: 0 });

export function AppTabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onMove,
  onOpen,
}: AppTabStripProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_AFTER_PX },
    }),
  );

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragged = tabs.find((tab) => tab.id === draggedId);

  const dropped = ({ active, over }: DragEndEvent) => {
    setDraggedId(null);

    if (over && active.id !== over.id) {
      onMove(String(active.id), String(over.id));
    }
  };

  return (
    <nav
      aria-label="Tabs"
      data-slot="app-tabs"
      className="hidden min-w-0 shrink-0 items-center gap-1.5 pb-2 md:flex"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[alongTheStrip]}
        onDragStart={({ active }) => setDraggedId(String(active.id))}
        onDragCancel={() => setDraggedId(null)}
        onDragEnd={dropped}
      >
        <SortableContext
          items={tabs.map((tab) => tab.id)}
          strategy={horizontalListSortingStrategy}
        >
          <ul className="flex min-w-0 items-center gap-1.5">
            {tabs.map((tab) => (
              <AppTabItem
                key={tab.id}
                tab={tab}
                icon={tabIconOf(tab.path)}
                active={tab.id === activeId}
                closable={tabs.length > 1}
                onSelect={() => onSelect(tab.id)}
                onClose={() => onClose(tab.id)}
              />
            ))}
          </ul>
        </SortableContext>

        <DragOverlay dropAnimation={TAB_SLIDE}>
          {dragged && (
            <AppTabGhost
              tab={dragged}
              icon={tabIconOf(dragged.path)}
              active={dragged.id === activeId}
            />
          )}
        </DragOverlay>
      </DndContext>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New tab"
        onClick={onOpen}
        className="text-muted-foreground"
      >
        <Plus className="size-3.5" aria-hidden />
      </Button>
    </nav>
  );
}
