import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { StationSection } from '@/components/features/board/column/StationSection';
import { TaskRow } from '@/components/features/board/task/TaskRow';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import type { Landing } from '@/lib/dragging';
import { landsOnEmptyStation, rowLanding } from '@/lib/drop-landing';
import { inboxItemPath } from '@/lib/inbox';
import { stationPath, stationShare } from '@/lib/station';
import { type Task, taskPath, tasksAt } from '@/lib/task';

type BoardStationProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
  place: number;
  tasks: readonly Task[];
  selected: ReadonlySet<string>;
  landing: Landing | null;
  open: boolean;
  onToggle: () => void;
  onAddTask: () => void;
  onSelect: (taskId: string, taken: boolean) => void;
};

export function BoardStation({
  slug,
  teamId,
  line,
  station,
  place,
  tasks,
  selected,
  landing,
  open,
  onToggle,
  onAddTask,
  onSelect,
}: BoardStationProps) {
  const here = tasksAt(tasks, station.id);
  const share = stationShare(place, line.stations.length);
  const picked = (candidate?: Task) =>
    Boolean(candidate && selected.has(candidate.id));

  return (
    <StationSection
      id={station.id}
      name={station.name}
      count={here.length}
      selectedCount={here.filter((task) => selected.has(task.id)).length}
      share={share}
      color={station.color}
      open={open}
      onToggle={onToggle}
      onAddTask={onAddTask}
      landing={landsOnEmptyStation(landing, station.id, here.length)}
      to={
        station.kind === 'work'
          ? stationPath(slug, teamId, line.id, station.id)
          : undefined
      }
    >
      <SortableContext
        items={here.map((each) => each.id)}
        strategy={verticalListSortingStrategy}
      >
        {here.map((task, spot, alongside) => (
          <TaskRow
            key={task.id}
            task={task}
            teamId={teamId}
            to={taskPath(slug, teamId, task.id)}
            reviewTo={
              task.awaitingReview
                ? inboxItemPath(slug, task.awaitingReview.conversationId)
                : undefined
            }
            stationColor={station.color}
            stationShare={share}
            landing={rowLanding(landing, station.id, task.id, spot)}
            selected={picked(task)}
            mergeTop={picked(task) && picked(alongside[spot - 1])}
            mergeBottom={picked(task) && picked(alongside[spot + 1])}
            onSelectedChange={(taken) => onSelect(task.id, taken)}
          />
        ))}
      </SortableContext>
    </StationSection>
  );
}
