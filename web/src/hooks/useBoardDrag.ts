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
import { useDragGuard } from '@/hooks/useDragGuard';
import { type Landing, landingFor } from '@/lib/dragging';
import type { Task } from '@/lib/task';

const HOLD = 6;

const kindOf = (collision: Collision) =>
  collision.data?.droppableContainer?.data?.current?.kind;

const dropping: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  const collisions = under.length > 0 ? under : rectIntersection(args);
  const onTasks = collisions.filter((each) => kindOf(each) === 'task');

  return onTasks.length > 0 ? onTasks : collisions;
};

type Board = {
  readonly teamId: string | undefined;
  readonly lineId: string;
  readonly tasks: readonly Task[];
};

export function useBoardDrag(board: Board) {
  const moveTask = useMoveTask();
  const swallowNextClick = useDragGuard();

  const [lifted, setLifted] = useState<string | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: HOLD } }),
  );

  const clear = () => {
    setLifted(null);
    setLanding(null);
  };

  const landingOver = (activeId: string, over: DragOverEvent['over']) =>
    over &&
    landingFor(board.tasks, activeId, {
      kind: over.data.current?.kind === 'task' ? 'task' : 'station',
      id: String(over.id),
      stationId: String(over.data.current?.stationId ?? over.id),
    });

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.kind !== 'task') {
      setLanding(null);
      return;
    }

    setLanding(landingOver(String(active.id), over) ?? null);
  };

  const settle = ({ active, over }: DragEndEvent) => {
    if (
      !over ||
      !board.teamId ||
      active.id === over.id ||
      active.data.current?.kind !== 'task'
    ) {
      return;
    }

    const moving = board.tasks.find((each) => each.id === active.id);
    const held = landingOver(String(active.id), over);

    if (moving && held) {
      moveTask.mutate({
        teamId: board.teamId,
        lineId: board.lineId,
        taskId: moving.id,
        revision: moving.revision,
        ...held,
      });
    }
  };

  return {
    sensors,
    collisionDetection: dropping,
    lifted,
    landing,
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
