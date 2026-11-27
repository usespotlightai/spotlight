import { DndContext } from '@dnd-kit/core';
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useRef,
} from 'react';

import { BoardStation } from '@/components/features/board/BoardStation';
import { SelectionBar } from '@/components/features/board/SelectionBar';
import { StopRunDialog } from '@/components/features/board/task/StopRunDialog';
import { TaskDragOverlay } from '@/components/features/board/TaskDragOverlay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useActiveCommands } from '@/hooks/useActiveCommands';
import { useBoardDrag } from '@/hooks/useBoardDrag';
import { useCollapsed } from '@/hooks/useCollapsed';
import { useCommands } from '@/hooks/useCommands';
import { useListKeys } from '@/hooks/useListKeys';
import type { LineResponseDto } from '@/lib/api';
import { type BoardView, inView } from '@/lib/board';
import { moveOptionsFor, type Task } from '@/lib/task';
import { cn } from '@/lib/utils';

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
  after?: ReactNode;
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
  after,
}: BoardProps) {
  const stations = useCollapsed(STATIONS_STORAGE_KEY);
  const rows = useRef<HTMLDivElement>(null);
  const moveTask = useMoveTask();
  const commands = useActiveCommands();
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
  const options = moveOptionsFor(line.stations, tasks, selected);
  const dragged = tasks.find((each) => each.id === drag.draggedId) ?? null;
  const stoppingAt = line.stations.find(
    (each) => each.id === drag.stopping?.landing.stationId,
  );

  const select = (taskId: string, taken: boolean) =>
    onSelectedChange((current) =>
      taken ? [...current, taskId] : current.filter((each) => each !== taskId),
    );

  const moveSelected = (stationId: string) => {
    for (const task of tasks.filter((each) => picked.has(each.id))) {
      if (task.stationId === stationId) {
        continue;
      }
      moveTask.mutate({
        teamId,
        lineId: line.id,
        taskId: task.id,
        revision: task.revision,
        stationId,
        afterTaskId: null,
      });
    }
    onSelectedChange([]);
  };

  useListKeys(
    rows,
    selected.length > 0 ? () => onSelectedChange([]) : undefined,
  );
  useCommands(
    options.map((option) => ({
      id: option.command,
      title: `Move to ${option.name}`,
      run: () => moveSelected(option.id),
    })),
  );

  return (
    <div ref={rows} className="relative flex min-h-0 flex-1 flex-col">
      <DndContext
        sensors={drag.sensors}
        collisionDetection={drag.collisionDetection}
        {...drag.handlers}
      >
        <ScrollArea
          className="min-h-0 flex-1"
          contentClassName={cn(
            'min-h-full flex flex-col gap-0.5 py-1.5',
            selected.length > 0 && 'pb-16',
          )}
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
          {after}
        </ScrollArea>

        <TaskDragOverlay stations={line.stations} task={dragged} />
      </DndContext>

      <SelectionBar
        count={selected.length}
        onActions={() =>
          commands.find((command) => command.id === 'palette.open')?.run()
        }
        onClear={() => onSelectedChange([])}
      />

      <StopRunDialog
        move={
          drag.stopping && stoppingAt
            ? { title: drag.stopping.task.title, station: stoppingAt.name }
            : null
        }
        onConfirm={drag.confirmStop}
        onClose={drag.cancelStop}
      />
    </div>
  );
}
