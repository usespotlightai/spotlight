import { DndContext } from '@dnd-kit/core';
import type { Dispatch, SetStateAction } from 'react';
import { BoardStation } from '@/components/features/board/BoardStation';
import { SelectionBar } from '@/components/features/board/SelectionBar';
import { TaskDragOverlay } from '@/components/features/board/TaskDragOverlay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useBoardDrag } from '@/hooks/useBoardDrag';
import { useCollapsed } from '@/hooks/useCollapsed';
import type { LineResponseDto } from '@/lib/api';
import { type BoardView, inView } from '@/lib/board';
import { moveTargetFor, type Task } from '@/lib/task';

const STATIONS_STORAGE_KEY = 'spotlight.collapsed-stations';

type BoardProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  tasks: readonly Task[];
  view: BoardView;
  selected: readonly string[];
  onSelectedChange: Dispatch<SetStateAction<readonly string[]>>;
  onAddTask: (stationId: string) => void;
};

export function Board({
  slug,
  teamId,
  line,
  tasks,
  view,
  selected,
  onSelectedChange,
  onAddTask,
}: BoardProps) {
  const stations = useCollapsed(STATIONS_STORAGE_KEY);
  const moveTask = useMoveTask();
  const drag = useBoardDrag({
    teamId,
    lineId: line.id,
    tasks,
    stations: line.stations,
  });

  const picked = new Set(selected);
  const shown = line.stations
    .map((station, place) => ({ station, place }))
    .filter(({ station }) => inView(view, station.kind));
  const target = moveTargetFor(line.stations, tasks, selected);
  const dragged = tasks.find((each) => each.id === drag.draggedId) ?? null;

  const select = (taskId: string, taken: boolean) =>
    onSelectedChange((current) =>
      taken ? [...current, taskId] : current.filter((each) => each !== taskId),
    );

  const moveSelected = () => {
    if (!target) {
      return;
    }
    for (const task of tasks.filter((each) => picked.has(each.id))) {
      moveTask.mutate({
        teamId,
        lineId: line.id,
        taskId: task.id,
        revision: task.revision,
        stationId: target.id,
        afterTaskId: null,
      });
    }
    onSelectedChange([]);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <DndContext
        sensors={drag.sensors}
        collisionDetection={drag.collisionDetection}
        {...drag.handlers}
      >
        <ScrollArea
          className="min-h-0 flex-1"
          contentClassName="min-h-full flex flex-col gap-0.5 py-1.5"
        >
          {shown.map(({ station, place }) => (
            <BoardStation
              key={station.id}
              slug={slug}
              teamId={teamId}
              line={line}
              station={station}
              place={place}
              tasks={tasks}
              selected={picked}
              landing={drag.landing}
              open={stations.isExpanded(station.id)}
              onToggle={() => stations.toggle(station.id)}
              onAddTask={() => onAddTask(station.id)}
              onSelect={select}
            />
          ))}
        </ScrollArea>

        <TaskDragOverlay stations={line.stations} task={dragged} />
      </DndContext>

      <SelectionBar
        count={selected.length}
        moveTo={target && { name: target.name, share: target.share }}
        onMove={moveSelected}
        onClear={() => onSelectedChange([])}
      />
    </div>
  );
}
