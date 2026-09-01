import {
  type Collision,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { BoardViews } from '@/components/board/BoardViews';
import { NewTaskDialog } from '@/components/board/NewTaskDialog';
import { SelectionBar } from '@/components/board/SelectionBar';
import { StationPreview } from '@/components/board/StationPreview';
import { StationSection } from '@/components/board/StationSection';
import { TaskPreview } from '@/components/board/TaskPreview';
import { TaskRow } from '@/components/board/TaskRow';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAddTask } from '@/hooks/api/useAddTask';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useReorderStations } from '@/hooks/api/useReorderStations';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useCollapsed } from '@/hooks/useCollapsed';
import { useDragGuard } from '@/hooks/useDragGuard';
import { asBoardView, inView } from '@/lib/board';
import { landingFor, reordered } from '@/lib/dragging';
import { inboxItemPath } from '@/lib/inbox';
import { stationPath, stationShare } from '@/lib/station';
import { moveTargetFor, type Task, taskPath, tasksAt } from '@/lib/task';
import { teamPath } from '@/lib/team';

const STATIONS_STORAGE_KEY = 'spotlight.collapsed-stations';

const kindOf = (collision: Collision) =>
  collision.data?.droppableContainer?.data?.current?.kind;

const dropping: CollisionDetection = (args) => {
  const draggingStation = args.active.data.current?.kind === 'station';

  const scoped = {
    ...args,
    droppableContainers: args.droppableContainers.filter((each) =>
      draggingStation
        ? each.data.current?.kind === 'station' && !each.data.current?.fixed
        : true,
    ),
  };

  const under = pointerWithin(scoped);
  const collisions = under.length > 0 ? under : rectIntersection(scoped);

  if (draggingStation) {
    return collisions;
  }

  const onTasks = collisions.filter((each) => kindOf(each) === 'task');

  return onTasks.length > 0 ? onTasks : collisions;
};

export function AssemblyLineBoard() {
  const { slug, teamId, lineId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines, isPending } = useAssemblyLines(teamId);
  const stations = useCollapsed(STATIONS_STORAGE_KEY);
  const { data: tasks } = useTasks(teamId);
  const addTask = useAddTask();
  const moveTask = useMoveTask();
  const reorderStations = useReorderStations();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [selected, setSelected] = useState<readonly string[]>([]);
  const swallowNextClick = useDragGuard();
  const [lifted, setLifted] = useState<string | null>(null);
  const [landing, setLanding] = useState<{
    stationId: string;
    afterTaskId: string | null;
  } | null>(null);
  const [stationLanding, setStationLanding] = useState<{
    stationId: string;
    edge: 'top' | 'bottom';
  } | null>(null);
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
  const liftedTask = (tasks ?? []).find((each) => each.id === lifted) ?? null;
  const liftedTaskStation = liftedTask
    ? line.stations.find((each) => each.id === liftedTask.stationId)
    : undefined;
  const liftedStation =
    line.stations.find((each) => each.id === lifted) ?? null;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || !teamId || active.id === over.id) {
      return;
    }

    const kind = active.data.current?.kind;

    if (kind === 'station') {
      reorderStations.mutate({
        teamId,
        lineId: line.id,
        stationIds: reordered(
          line.stations.map((each) => each.id),
          String(active.id),
          String(over.id),
        ),
      });
      return;
    }

    if (kind !== 'task') {
      return;
    }

    const overData = over.data.current;
    const landing = landingFor(tasks ?? [], String(active.id), {
      kind: overData?.kind === 'task' ? 'task' : 'station',
      id: String(over.id),
      stationId: String(overData?.stationId ?? over.id),
    });

    if (landing) {
      moveTask.mutate({
        teamId,
        lineId: line.id,
        taskId: String(active.id),
        ...landing,
      });
    }
  };

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
        <DndContext
          sensors={sensors}
          collisionDetection={dropping}
          onDragStart={({ active }: DragStartEvent) =>
            setLifted(String(active.id))
          }
          onDragOver={({ active, over }: DragOverEvent) => {
            if (!over) {
              setLanding(null);
              setStationLanding(null);
              return;
            }

            if (active.data.current?.kind === 'station') {
              const order = line.stations.map((each) => each.id);
              const from = order.indexOf(String(active.id));
              const to = order.indexOf(String(over.id));

              setLanding(null);
              setStationLanding(
                from === to
                  ? null
                  : {
                      stationId: String(over.id),
                      edge: from < to ? 'bottom' : 'top',
                    },
              );
              return;
            }

            if (active.data.current?.kind !== 'task') {
              setLanding(null);
              setStationLanding(null);
              return;
            }

            setStationLanding(null);

            const overData = over.data.current;

            setLanding(
              landingFor(tasks ?? [], String(active.id), {
                kind: overData?.kind === 'task' ? 'task' : 'station',
                id: String(over.id),
                stationId: String(overData?.stationId ?? over.id),
              }),
            );
          }}
          onDragCancel={() => {
            setLifted(null);
            setLanding(null);
            setStationLanding(null);
            swallowNextClick();
          }}
          onDragEnd={(event) => {
            setLifted(null);
            setLanding(null);
            setStationLanding(null);
            swallowNextClick();
            onDragEnd(event);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1.5">
            <SortableContext
              items={line.stations.map((each) => each.id)}
              strategy={() => null}
            >
              {line.stations
                .map((station, place) => ({ station, place }))
                .filter(({ station }) => inView(view, station.kind))
                .map(({ station, place }) => (
                  <StationSection
                    key={station.id}
                    id={station.id}
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
                    landingEdge={
                      stationLanding?.stationId === station.id
                        ? stationLanding.edge
                        : undefined
                    }
                    landing={
                      landing?.stationId === station.id &&
                      landing.afterTaskId === null &&
                      tasksAt(tasks, station.id).length === 0
                    }
                    fixed={station.kind !== 'work'}
                    to={
                      slug && teamId && station.kind === 'work'
                        ? stationPath(slug, teamId, line.id, station.id)
                        : undefined
                    }
                  >
                    <SortableContext
                      items={tasksAt(tasks, station.id).map((each) => each.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {tasksAt(tasks, station.id).map(
                        (task, spot, standing) => {
                          const picked = (candidate?: Task) =>
                            Boolean(
                              candidate && selected.includes(candidate.id),
                            );

                          return (
                            <TaskRow
                              key={task.id}
                              task={task}
                              to={
                                slug && teamId
                                  ? taskPath(slug, teamId, task.id)
                                  : ''
                              }
                              reviewTo={
                                slug && task.awaitingReview
                                  ? inboxItemPath(
                                      slug,
                                      task.awaitingReview.conversationId,
                                    )
                                  : undefined
                              }
                              stationColor={station.color}
                              stationShare={stationShare(
                                place,
                                line.stations.length,
                              )}
                              landing={
                                landing?.stationId === station.id
                                  ? landing.afterTaskId === task.id
                                    ? 'below'
                                    : landing.afterTaskId === null && spot === 0
                                      ? 'above'
                                      : undefined
                                  : undefined
                              }
                              selected={picked(task)}
                              mergeTop={
                                picked(task) && picked(standing[spot - 1])
                              }
                              mergeBottom={
                                picked(task) && picked(standing[spot + 1])
                              }
                              onSelectedChange={(taken) =>
                                setSelected((current) =>
                                  taken
                                    ? [...current, task.id]
                                    : current.filter(
                                        (each) => each !== task.id,
                                      ),
                                )
                              }
                            />
                          );
                        },
                      )}
                    </SortableContext>
                  </StationSection>
                ))}
            </SortableContext>
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 140,
              easing: 'ease-out',
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: '1' } },
              }),
              keyframes: ({ transform }) => [
                {
                  opacity: 1,
                  transform: CSS.Transform.toString(transform.initial),
                },
                {
                  opacity: 0,
                  transform: CSS.Transform.toString(transform.initial),
                },
              ],
            }}
          >
            {liftedTask && (
              <TaskPreview
                task={liftedTask}
                stationColor={liftedTaskStation?.color ?? '#a3a8b0'}
                stationShare={stationShare(
                  line.stations.findIndex(
                    (each) => each.id === liftedTask.stationId,
                  ),
                  line.stations.length,
                )}
              />
            )}

            {liftedStation && (
              <StationPreview
                name={liftedStation.name}
                count={tasksAt(tasks, liftedStation.id).length}
                color={liftedStation.color}
                share={stationShare(
                  line.stations.findIndex(
                    (each) => each.id === liftedStation.id,
                  ),
                  line.stations.length,
                )}
              />
            )}
          </DragOverlay>
        </DndContext>

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
                afterTaskId: null,
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
        slug={slug}
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
