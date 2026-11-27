import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type Modifier,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { type ReactNode, useState } from 'react';

import { TAB_SLIDE } from '@/components/shell/tabs/app-tab-look';
import { AppTabGhost } from '@/components/shell/tabs/AppTabGhost';
import { sideOf, TabDragContext } from '@/components/shell/tabs/tab-drag';
import { type AppTab, type SplitSide, tabIconOf } from '@/lib/app-tabs';

type TabDragProps = {
  tabs: readonly AppTab[];
  activeId: string;
  canPlace: (id: string, side: SplitSide) => boolean;
  onMove: (id: string, to: string) => void;
  onPlace: (id: string, side: SplitSide) => void;
  children: ReactNode;
};

const DRAG_AFTER_PX = 4;

const TEAR_OFF_PX = 24;

const alongTheStripUntilTornOff: Modifier = ({ transform }) =>
  Math.abs(transform.y) < TEAR_OFF_PX ? { ...transform, y: 0 } : transform;

const zonesFirst: CollisionDetection = (args) => {
  const zones = args.droppableContainers.filter(({ id }) => sideOf(id));
  const inZone = pointerWithin({ ...args, droppableContainers: zones });

  if (inZone.length > 0) {
    return inZone;
  }

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      ({ id }) => !sideOf(id),
    ),
  });
};

export function TabDrag({
  tabs,
  activeId,
  canPlace,
  onMove,
  onPlace,
  children,
}: TabDragProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_AFTER_PX },
    }),
  );

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overSide, setOverSide] = useState<SplitSide | null>(null);
  const dragged = tabs.find((tab) => tab.id === draggedId);

  const dropped = ({ active, over }: DragEndEvent) => {
    setDraggedId(null);
    const side = over ? sideOf(over.id) : null;

    if (side) {
      onPlace(String(active.id), side);
    } else if (over && active.id !== over.id) {
      onMove(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={zonesFirst}
      modifiers={[alongTheStripUntilTornOff]}
      onDragStart={({ active }) => {
        setDraggedId(String(active.id));
        setOverSide(null);
      }}
      onDragOver={({ over }) => setOverSide(over ? sideOf(over.id) : null)}
      onDragCancel={() => setDraggedId(null)}
      onDragEnd={dropped}
    >
      <TabDragContext
        value={{
          draggedId,
          overSide,
          accepts: (side) => draggedId !== null && canPlace(draggedId, side),
        }}
      >
        {children}
      </TabDragContext>

      <DragOverlay dropAnimation={overSide ? null : TAB_SLIDE}>
        {dragged && (
          <AppTabGhost
            tab={dragged}
            icon={tabIconOf(dragged.path)}
            active={dragged.id === activeId}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
