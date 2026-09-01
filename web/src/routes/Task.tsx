import { GitBranch, GitPullRequest } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { StationSelect } from '@/components/board/StationSelect';
import { TaskActions } from '@/components/board/TaskActions';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { PersonAvatar } from '@/components/common/avatar/PersonAvatar';
import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskActivity } from '@/components/runs/TaskActivity';
import { TraceView } from '@/components/trace/TraceView';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useDeleteTask } from '@/hooks/api/useDeleteTask';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { assemblyLinePath, teamPath } from '@/lib/team';
import { cn } from '@/lib/utils';

const VIEWS = [
  { id: 'details', label: 'Details' },
  { id: 'trace', label: 'Trace' },
] as const;

type View = (typeof VIEWS)[number]['id'];

export function Task() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines } = useAssemblyLines(teamId);
  const { data: tasks, isPending } = useTasks(teamId);
  const moveTask = useMoveTask();
  const deleteTask = useDeleteTask();
  const navigate = useNavigate();
  // Followed from the trace list, which means to open on the trace itself.
  const [asked] = useSearchParams();
  const [view, setView] = useState<View>(
    asked.get('view') === 'trace' ? 'trace' : 'details',
  );
  const { data: runs } = useTaskRuns(teamId, taskId);
  const { data: journals } = useTaskJournal(slug, taskId);

  if (isPending) {
    return null;
  }

  const task = tasks?.find((candidate) => candidate.id === taskId);

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

  const line = lines?.find((candidate) =>
    candidate.stations.some((station) => station.id === task.stationId),
  );
  const station = line?.stations.find((each) => each.id === task.stationId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return (
    <>
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              ...(team
                ? [
                    {
                      label: team.name,
                      icon: (
                        <InitialAvatar name={team.name} className="bg-card" />
                      ),
                      to: slug && teamId ? teamPath(slug, teamId) : undefined,
                    },
                  ]
                : []),
              ...(line
                ? [
                    {
                      label: line.name,
                      to:
                        slug && teamId
                          ? assemblyLinePath(slug, teamId, line.id)
                          : undefined,
                    },
                  ]
                : []),
              { label: task.title },
            ]}
          />
        }
        trailing={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md bg-accent p-0.5">
              {VIEWS.map((each) => (
                <button
                  key={each.id}
                  type="button"
                  onClick={() => setView(each.id)}
                  aria-pressed={view === each.id}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    view === each.id
                      ? 'bg-card text-foreground shadow-control'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {each.label}
                </button>
              ))}
            </div>

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
                          ? assemblyLinePath(slug, teamId, line.id)
                          : teamPath(slug ?? '', teamId),
                      ),
                  },
                );
              }}
            />
          </div>
        }
      />

      {view === 'trace' ? (
        <TraceView runs={runs ?? []} journals={journals ?? []} />
      ) : (
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

                {task.repository && (
                  <div className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm">
                    <GitBranch
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />

                    <span className="truncate text-foreground">
                      {task.repository}
                    </span>
                  </div>
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

                    <span className="truncate text-foreground">
                      Pull request
                    </span>
                  </a>
                )}

                {task.raisedBy && (
                  <div className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm">
                    <PersonAvatar
                      person={task.raisedBy}
                      className="size-4 data-[size=sm]:size-4"
                    />

                    <span className="truncate text-foreground">
                      {task.raisedBy.name}
                    </span>
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
