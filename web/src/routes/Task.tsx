import { useParams } from 'react-router';
import { StationSelect } from '@/components/board/StationSelect';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { assemblyLinePath, teamPath } from '@/lib/team';

export function Task() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines } = useAssemblyLines(teamId);
  const { data: tasks, isPending } = useTasks(teamId);
  const moveTask = useMoveTask();

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
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
