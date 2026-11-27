import {
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DroppableContainer,
  pointerWithin,
  rectIntersection,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import { useState } from 'react';

import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useDragGuard } from '@/hooks/useDragGuard';
import { useDragSensors } from '@/hooks/useDragSensors';
import type { StationResponseDto } from '@/lib/api';
import { type Landing, landingFor } from '@/lib/dragging';
import { nonEmpty } from '@/lib/non-empty';
import { mayLand, stopsRun, type Task } from '@/lib/task';

const kindOf = (
  collision: Collision,
  containers: readonly DroppableContainer[],
): unknown =>
  containers.find((each) => each.id === collision.id)?.data.current?.kind;

const dropping: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  const collisions = under.length > 0 ? under : rectIntersection(args);
  const onTasks = collisions.filter(
    (each) => kindOf(each, args.droppableContainers) === 'task',
  );

  return onTasks.length > 0 ? onTasks : collisions;
};

type Board = {
  readonly teamId: string | undefined;
  readonly lineId: string;
  readonly tasks: readonly Task[];
  readonly stations: readonly StationResponseDto[];
};

type Stopping = {
  readonly task: Task;
  readonly landing: Landing;
};

type BoardDragResult = {
  sensors: SensorDescriptor<SensorOptions>[];
  collisionDetection: CollisionDetection;
  draggedId: string | null;
  landing: Landing | null;
  stopping: Stopping | null;
  confirmStop: () => void;
  cancelStop: () => void;
  handlers: {
    onDragStart: ({ active }: DragStartEvent) => void;
    onDragOver: ({ active, over }: DragOverEvent) => void;
    onDragCancel: () => void;
    onDragEnd: (event: DragEndEvent) => void;
  };
};

export function useBoardDrag(board: Board): BoardDragResult {
  const moveTask = useMoveTask();
  const swallowNextClick = useDragGuard();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const [stopping, setStopping] = useState<Stopping | null>(null);

  const sensors = useDragSensors();

  const clear = () => {
    setDraggedId(null);
    setLanding(null);
  };

  const landingOver = (moving: Task, over: DragOverEvent['over']) => {
    const target =
      over &&
      landingFor(board.tasks, moving.id, {
        kind: over.data.current?.kind === 'task' ? 'task' : 'station',
        id: String(over.id),
        stationId: String(over.data.current?.stationId ?? over.id),
      });

    return target && mayLand(moving, target.stationId) ? target : null;
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const moving = board.tasks.find((each) => each.id === active.id);

    if (!over || !moving || active.data.current?.kind !== 'task') {
      setLanding(null);
      return;
    }

    setLanding(landingOver(moving, over));
  };

  const move = (task: Task, target: Landing) => {
    if (!nonEmpty(board.teamId)) {
      return;
    }

    moveTask.mutate({
      teamId: board.teamId,
      lineId: board.lineId,
      taskId: task.id,
      revision: task.revision,
      ...target,
    });
  };

  const drop = ({ active, over }: DragEndEvent) => {
    if (
      !over ||
      !nonEmpty(board.teamId) ||
      active.id === over.id ||
      active.data.current?.kind !== 'task'
    ) {
      return;
    }

    const moving = board.tasks.find((each) => each.id === active.id);
    const target = moving ? landingOver(moving, over) : null;

    if (!moving || !target) {
      return;
    }

    if (stopsRun(board.stations, moving, target.stationId)) {
      setStopping({ task: moving, landing: target });
    } else {
      move(moving, target);
    }
  };

  return {
    sensors,
    collisionDetection: dropping,
    draggedId,
    landing,
    stopping,
    confirmStop: () => {
      if (stopping) {
        move(stopping.task, stopping.landing);
      }
      setStopping(null);
    },
    cancelStop: () => setStopping(null),
    handlers: {
      onDragStart: ({ active }: DragStartEvent) =>
        setDraggedId(String(active.id)),
      onDragOver,
      onDragCancel: () => {
        clear();
        swallowNextClick();
      },
      onDragEnd: (event: DragEndEvent) => {
        clear();
        swallowNextClick();
        drop(event);
      },
    },
  };
}
