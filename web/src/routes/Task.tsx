import { GitPullRequest } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { NotFound } from '@/components/features/board/NotFound';
import { AssigneePicker } from '@/components/features/board/task/AssigneePicker';
import { StationSelect } from '@/components/features/board/task/StationSelect';
import { TaskActions } from '@/components/features/board/task/TaskActions';
import { TaskSkeleton } from '@/components/features/board/task/TaskSkeleton';
import { TaskActivity } from '@/components/features/runs/TaskActivity';
import { TaskChangeStackLink } from '@/components/features/runs/TaskChangeStackLink';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useDeleteTask } from '@/hooks/api/useDeleteTask';
import { useLines } from '@/hooks/api/useLines';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed, loading } from '@/lib/query';
import { linePath, teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function Task() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const lines = useLines(teamId);
  const tasks = useTasks(teamId);
  const moveTask = useMoveTask();
  const deleteTask = useDeleteTask();
  const navigate = useNavigate();

  const task = tasks.data?.find((candidate) => candidate.id === taskId);
  const line = lines.data?.find((candidate) =>
    candidate.stations.some((station) => station.id === task?.stationId),
  );
  const station = line?.stations.find((each) => each.id === task?.stationId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team
      ? [
          {
            label: team.name,
            avatar: team.name,
            to: slug && teamId ? teamPath(slug, teamId) : undefined,
          },
        ]
      : []),
    ...(line
      ? [
          {
            label: line.name,
            to: slug && teamId ? linePath(slug, teamId, line.id) : undefined,
          },
        ]
      : []),
    { label: task?.title ?? '' },
  ];
  const { trail, forward } = useTrail(base);

  if (failed(tasks)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The task"
          retrying={tasks.isFetching}
          onRetry={() => void tasks.refetch()}
        />
      </PageNotice>
    );
  }

  if (loading(tasks) || loading(lines)) {
    return <TaskSkeleton known={trail.slice(0, -1)} />;
  }

  if (!task) {
    return (
      <NotFound title="Task not found" to={teamPath(slug ?? '', teamId ?? '')}>
        This team has no task at that address.
      </NotFound>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        actions={
          slug && teamId ? (
            <TaskChangeStackLink slug={slug} teamId={teamId} taskId={task.id} />
          ) : undefined
        }
        trailing={
          <TaskActions
            title={task.title}
            onDelete={() => {
              if (!teamId) {
                return;
              }

              deleteTask.mutate(
                { teamId, taskId: task.id },
                {
                  onSuccess: () =>
                    void navigate(
                      slug && line
                        ? linePath(slug, teamId, line.id)
                        : teamPath(slug ?? '', teamId),
                    ),
                },
              );
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-8 py-8">
          <main className="flex min-w-0 flex-1 flex-col gap-3">
            <h1 className="font-semibold text-2xl text-foreground leading-8 tracking-tight">
              {task.title}
            </h1>

            {task.description ? (
              <MarkdownEditor
                readOnly
                initialValue={task.description}
                placeholder=""
                ariaLabel="Description"
                className="border-none bg-transparent p-0"
              />
            ) : (
              <p className="text-muted-foreground text-sm">No description</p>
            )}

            <AttachmentTiles attachments={task.attachments} />

            <div className="pt-4">
              <TaskActivity slug={slug} teamId={teamId} taskId={task.id} />
            </div>
          </main>

          <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-4 self-start lg:flex">
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
                      stationId,
                      afterTaskId: null,
                    })
                  }
                />
              )}

              {teamId && (
                <AssigneePicker teamId={teamId} task={task} variant="row" />
              )}

              {task.pullRequest && (
                <a
                  href={task.pullRequest}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent"
                >
                  <GitPullRequest
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />

                  <span className="truncate text-foreground">Pull request</span>
                </a>
              )}
            </section>
          </aside>
        </div>
      </div>
    </TrailContext>
  );
}
