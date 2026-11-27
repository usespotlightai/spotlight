import { useState } from 'react';

import { AssigneePicker } from '@/components/features/board/task/AssigneePicker';
import { SendBackDialog } from '@/components/features/board/task/SendBackDialog';
import { StationSelect } from '@/components/features/board/task/StationSelect';
import { StopRunDialog } from '@/components/features/board/task/StopRunDialog';
import { TASK_PROPERTIES } from '@/components/features/board/task/TaskLayout';
import { TaskPullRequestLink } from '@/components/features/board/task/TaskPullRequestLink';
import { TaskSourceLink } from '@/components/features/board/task/TaskSourceLink';
import { TaskChangesLink } from '@/components/features/changes/TaskChangesLink';
import { OpenInEditorRow } from '@/components/features/editor/OpenInEditorRow';
import { TaskTraceLink } from '@/components/features/trace/TaskTraceLink';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { stopsRun, type Task } from '@/lib/task';

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
  const [stopping, setStopping] = useState<string | null>(null);
  const station = line?.stations.find((each) => each.id === task.stationId);
  const stoppingAt = line?.stations.find((each) => each.id === stopping);
  const linked = nonEmpty(slug) && nonEmpty(teamId) ? { slug, teamId } : null;
  const [sendingBackTo, setSendingBackTo] = useState<StationResponseDto | null>(
    null,
  );

  const move = (stationId: string, reason?: string) => {
    if (!nonEmpty(teamId) || !line) {
      return;
    }

    moveTask.mutate({
      teamId,
      lineId: line.id,
      taskId: task.id,
      revision: task.revision,
      stationId,
      afterTaskId: null,
      ...(nonEmpty(reason) ? { reason } : {}),
    });
  };

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
            held={task.hold}
            sendsBackTo={task.sendsBackTo}
            onChange={(stationId) => {
              const to = line.stations.find((each) => each.id === stationId);

              if (to && task.sendsBackTo.includes(to.id)) {
                setSendingBackTo(to);
                return;
              }

              if (stopsRun(line.stations, task, stationId)) {
                setStopping(stationId);
                return;
              }

              move(stationId);
            }}
          />
        )}

        <SendBackDialog
          station={sendingBackTo?.name ?? null}
          onOpenChange={(open) => !open && setSendingBackTo(null)}
          onSend={(reason) => {
            if (sendingBackTo) {
              move(sendingBackTo.id, reason);
            }
            setSendingBackTo(null);
          }}
        />

        <StopRunDialog
          move={
            stoppingAt ? { title: task.title, station: stoppingAt.name } : null
          }
          onConfirm={() => {
            if (stoppingAt) {
              move(stoppingAt.id);
            }
            setStopping(null);
          }}
          onClose={() => setStopping(null)}
        />

        {nonEmpty(teamId) && (
          <AssigneePicker teamId={teamId} task={task} variant="row" />
        )}

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
