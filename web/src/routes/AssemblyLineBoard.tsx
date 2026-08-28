import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { BoardViews } from '@/components/board/BoardViews';
import { NewTaskDialog } from '@/components/board/NewTaskDialog';
import { SelectionBar } from '@/components/board/SelectionBar';
import { StationSection } from '@/components/board/StationSection';
import { TaskRow } from '@/components/board/TaskRow';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAddTask } from '@/hooks/api/useAddTask';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useCollapsed } from '@/hooks/useCollapsed';
import { asBoardView, inView } from '@/lib/board';
import { stationPath, stationShare } from '@/lib/station';
import { moveTargetFor, type Task, taskPath, tasksAt } from '@/lib/task';
import { teamPath } from '@/lib/team';

const STATIONS_STORAGE_KEY = 'spotlight.collapsed-stations';

export function AssemblyLineBoard() {
  const { slug, teamId, lineId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines, isPending } = useAssemblyLines(teamId);
  const stations = useCollapsed(STATIONS_STORAGE_KEY);
  const { data: tasks } = useTasks(teamId);
  const addTask = useAddTask();
  const moveTask = useMoveTask();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [params, setParams] = useSearchParams();
  const view = asBoardView(params.get('view'));
  const [adding, setAdding] = useState<string | null>(null);

  if (isPending) {
    return null;
  }

  const line = lines?.find((candidate) => candidate.id === lineId);

  if (!line) {
    return (
      <>
        <PageHeader title="Assembly line not found" />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            This team has no assembly line at that address.
          </p>
        </div>
      </>
    );
  }

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);
  const target = moveTargetFor(line.stations, tasks ?? [], selected);

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
              { label: line.name },
            ]}
          />
        }
      />

      <BoardViews
        current={view}
        onChange={(next) => {
          setParams({ view: next });
          setSelected([]);
        }}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1.5">
          {line.stations
            .map((station, place) => ({ station, place }))
            .filter(({ place }) => inView(view, place))
            .map(({ station, place }) => (
              <StationSection
                key={station.id}
                name={station.name}
                count={tasksAt(tasks, station.id).length}
                selectedCount={
                  tasksAt(tasks, station.id).filter((task) =>
                    selected.includes(task.id),
                  ).length
                }
                share={stationShare(place, line.stations.length)}
                color={station.color}
                open={stations.isExpanded(station.id)}
                onToggle={() => stations.toggle(station.id)}
                onAddTask={() => setAdding(station.id)}
                to={
                  slug && teamId
                    ? stationPath(slug, teamId, line.id, station.id)
                    : undefined
                }
              >
                {tasksAt(tasks, station.id).map((task, spot, standing) => {
                  const picked = (candidate?: Task) =>
                    Boolean(candidate && selected.includes(candidate.id));

                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      to={slug && teamId ? taskPath(slug, teamId, task.id) : ''}
                      stationColor={station.color}
                      stationShare={stationShare(place, line.stations.length)}
                      selected={picked(task)}
                      mergeTop={picked(task) && picked(standing[spot - 1])}
                      mergeBottom={picked(task) && picked(standing[spot + 1])}
                      onSelectedChange={(taken) =>
                        setSelected((current) =>
                          taken
                            ? [...current, task.id]
                            : current.filter((each) => each !== task.id),
                        )
                      }
                    />
                  );
                })}
              </StationSection>
            ))}
        </div>

        <SelectionBar
          count={selected.length}
          moveTo={target && { name: target.name, share: target.share }}
          onMove={() => {
            if (!teamId || !target) {
              return;
            }
            for (const taskId of selected) {
              moveTask.mutate({
                teamId,
                lineId: line.id,
                taskId,
                stationId: target.id,
              });
            }
            setSelected([]);
          }}
          onClear={() => setSelected([])}
        />
      </div>

      <NewTaskDialog
        open={adding !== null}
        onOpenChange={(next) => !next && setAdding(null)}
        lineName={line.name}
        stationName={
          line.stations.find((each) => each.id === adding)?.name ?? ''
        }
        onCreate={(task) =>
          adding &&
          teamId &&
          addTask.mutate({ teamId, lineId: line.id, stationId: adding, task })
        }
      />
    </>
  );
}
