import { GitPullRequest } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AssigneePicker } from '@/components/features/board/task/AssigneePicker';
import { StationSelect } from '@/components/features/board/task/StationSelect';
import { TaskActions } from '@/components/features/board/task/TaskActions';
import { TaskActivity } from '@/components/features/runs/TaskActivity';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
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
import { linePath, teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function Task() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines } = useLines(teamId);
  const { data: tasks, isPending } = useTasks(teamId);
  const moveTask = useMoveTask();
  const deleteTask = useDeleteTask();
  const navigate = useNavigate();

  const task = tasks?.find((candidate) => candidate.id === taskId);
  const line = lines?.find((candidate) =>
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
    ...(task ? [{ label: task.title }] : []),
  ];
  const { trail, forward } = useTrail(base);

  if (isPending) {
    return null;
  }

  if (!task) {
    return (
      <>
        <PageHeader title="Task not found" />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            This team has no task at that address.
          </p>
        </div>
      </>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
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
