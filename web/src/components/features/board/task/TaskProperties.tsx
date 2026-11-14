import { AssigneePicker } from '@/components/features/board/task/AssigneePicker';
import { StationSelect } from '@/components/features/board/task/StationSelect';
import { TASK_PROPERTIES } from '@/components/features/board/task/TaskLayout';
import { TaskPullRequestLink } from '@/components/features/board/task/TaskPullRequestLink';
import { TaskSourceLink } from '@/components/features/board/task/TaskSourceLink';
import { TaskChangesLink } from '@/components/features/changes/TaskChangesLink';
import { OpenInEditorRow } from '@/components/features/editor/OpenInEditorRow';
import { TaskTraceLink } from '@/components/features/trace/TaskTraceLink';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import type { LineResponseDto } from '@/lib/api';
import type { Task } from '@/lib/task';

type TaskPropertiesProps = {
  slug?: string;
  teamId?: string;
  task: Task;
  line?: LineResponseDto;
};

export function TaskProperties({
  slug,
  teamId,
  task,
  line,
}: TaskPropertiesProps) {
  const moveTask = useMoveTask();
  const station = line?.stations.find((each) => each.id === task.stationId);
  const linked = slug && teamId ? { slug, teamId } : null;

  return (
    <aside className={TASK_PROPERTIES}>
      <section className="flex flex-col gap-1.5">
        <h2 className="px-2 font-medium text-muted-foreground text-xs">
          Properties
        </h2>

        {line && station && (
          <StationSelect
            stations={line.stations}
            value={station.id}
            onChange={(stationId) =>
              teamId &&
              moveTask.mutate({
                teamId,
                lineId: line.id,
                taskId: task.id,
                revision: task.revision,
                stationId,
                afterTaskId: null,
              })
            }
          />
        )}

        {teamId && <AssigneePicker teamId={teamId} task={task} variant="row" />}

        {linked && (
          <TaskSourceLink
            slug={linked.slug}
            teamId={linked.teamId}
            source={task.source}
          />
        )}

        {linked && (
          <TaskChangesLink
            slug={linked.slug}
            teamId={linked.teamId}
            taskId={task.id}
          />
        )}

        {linked && (
          <TaskTraceLink
            slug={linked.slug}
            teamId={linked.teamId}
            taskId={task.id}
          />
        )}

        {linked && (
          <OpenInEditorRow
            slug={linked.slug}
            target={{ kind: 'task', id: task.id }}
          />
        )}

        {task.pullRequests.map((href) => (
          <TaskPullRequestLink
            key={href}
            href={href}
            named={task.pullRequests.length > 1}
          />
        ))}
      </section>
    </aside>
  );
}
