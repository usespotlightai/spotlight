import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
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
import { ProposeLine } from '@/components/integrations/ProposeLine';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAddTask } from '@/hooks/api/useAddTask';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useBoardDrag } from '@/hooks/useBoardDrag';
import { useCollapsed } from '@/hooks/useCollapsed';
import { asBoardView, inView } from '@/lib/board';
import { inboxItemPath } from '@/lib/inbox';
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
  // Dragging moves one task; the selection bar moves however many are picked.
  const moveTask = useMoveTask();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [params, setParams] = useSearchParams();
  const view = asBoardView(params.get('view'));
  const [adding, setAdding] = useState<string | null>(null);

  const line = lines?.find((candidate) => candidate.id === lineId);

  const drag = useBoardDrag({
    teamId,
    lineId: line?.id ?? '',
    stationIds: line?.stations.map((each) => each.id) ?? [],
    tasks: tasks ?? [],
  });

  if (isPending) {
    return null;
  }

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
  const liftedTask =
    (tasks ?? []).find((each) => each.id === drag.lifted) ?? null;
  const liftedTaskStation = liftedTask
    ? line.stations.find((each) => each.id === liftedTask.stationId)
    : undefined;
  const liftedStation =
    line.stations.find((each) => each.id === drag.lifted) ?? null;

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
        actions={
          <ProposeLine teamId={teamId} lineId={line.id} name={line.name} />
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
          sensors={drag.sensors}
          collisionDetection={drag.collisionDetection}
          {...drag.handlers}
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
                      drag.stationLanding?.stationId === station.id
                        ? drag.stationLanding.edge
                        : undefined
                    }
                    landing={
                      drag.landing?.stationId === station.id &&
                      drag.landing.afterTaskId === null &&
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
                                drag.landing?.stationId === station.id
                                  ? drag.landing.afterTaskId === task.id
                                    ? 'below'
                                    : drag.landing.afterTaskId === null &&
                                        spot === 0
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
