import {
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useState } from 'react';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useReorderStations } from '@/hooks/api/useReorderStations';
import { useDragGuard } from '@/hooks/useDragGuard';
import { type Landing, landingFor, reordered } from '@/lib/dragging';
import type { Task } from '@/lib/task';

const HOLD = 6;

const kindOf = (collision: Collision) =>
  collision.data?.droppableContainer?.data?.current?.kind;

/**
 * A station is dropped among stations, and a task among tasks. The pointer
 * decides where it is; only when it is over nothing does the nearest
 * rectangle win.
 */
const dropping: CollisionDetection = (args) => {
  const draggingStation = args.active.data.current?.kind === 'station';

  const scoped = {
    ...args,
    droppableContainers: args.droppableContainers.filter((each) =>
      draggingStation
        ? each.data.current?.kind === 'station' && !each.data.current?.fixed
        : true,
    ),
  };

  const under = pointerWithin(scoped);
  const collisions = under.length > 0 ? under : rectIntersection(scoped);

  if (draggingStation) {
    return collisions;
  }

  const onTasks = collisions.filter((each) => kindOf(each) === 'task');

  return onTasks.length > 0 ? onTasks : collisions;
};

export interface StationLanding {
  readonly stationId: string;
  readonly edge: 'top' | 'bottom';
}

type Board = {
  readonly teamId: string | undefined;
  readonly lineId: string;
  readonly stationIds: readonly string[];
  readonly tasks: readonly Task[];
};

export function useBoardDrag(board: Board) {
  const moveTask = useMoveTask();
  const reorderStations = useReorderStations();
  const swallowNextClick = useDragGuard();

  const [lifted, setLifted] = useState<string | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const [stationLanding, setStationLanding] = useState<StationLanding | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: HOLD } }),
  );

  const clear = () => {
    setLifted(null);
    setLanding(null);
    setStationLanding(null);
  };

  const landingOver = (activeId: string, over: DragOverEvent['over']) =>
    over &&
    landingFor(board.tasks, activeId, {
      kind: over.data.current?.kind === 'task' ? 'task' : 'station',
      id: String(over.id),
      stationId: String(over.data.current?.stationId ?? over.id),
    });

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) {
      setLanding(null);
      setStationLanding(null);
      return;
    }

    const kind = active.data.current?.kind;

    if (kind === 'station') {
      const from = board.stationIds.indexOf(String(active.id));
      const to = board.stationIds.indexOf(String(over.id));

      setLanding(null);
      setStationLanding(
        from === to
          ? null
          : { stationId: String(over.id), edge: from < to ? 'bottom' : 'top' },
      );
      return;
    }

    if (kind !== 'task') {
      setLanding(null);
      setStationLanding(null);
      return;
    }

    setStationLanding(null);
    setLanding(landingOver(String(active.id), over) ?? null);
  };

  const settle = ({ active, over }: DragEndEvent) => {
    if (!over || !board.teamId || active.id === over.id) {
      return;
    }

    const kind = active.data.current?.kind;

    if (kind === 'station') {
      reorderStations.mutate({
        teamId: board.teamId,
        lineId: board.lineId,
        stationIds: reordered(
          [...board.stationIds],
          String(active.id),
          String(over.id),
        ),
      });
      return;
    }

    if (kind !== 'task') {
      return;
    }

    const held = landingOver(String(active.id), over);

    if (held) {
      moveTask.mutate({
        teamId: board.teamId,
        lineId: board.lineId,
        taskId: String(active.id),
        ...held,
      });
    }
  };

  return {
    sensors,
    collisionDetection: dropping,
    lifted,
    landing,
    stationLanding,
    handlers: {
      onDragStart: ({ active }: DragStartEvent) => setLifted(String(active.id)),
      onDragOver,
      onDragCancel: () => {
        clear();
        swallowNextClick();
      },
      onDragEnd: (event: DragEndEvent) => {
        clear();
        swallowNextClick();
        settle(event);
      },
    },
  };
}
