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
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { BoardSkeleton } from '@/components/features/board/BoardSkeleton';
import { StationSection } from '@/components/features/board/column/StationSection';
import { NotFound } from '@/components/features/board/NotFound';
import { SelectionBar } from '@/components/features/board/SelectionBar';
import { NewTaskDialog } from '@/components/features/board/task/NewTaskDialog';
import { TaskPreview } from '@/components/features/board/task/TaskPreview';
import { TaskRow } from '@/components/features/board/task/TaskRow';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import { ViewPills } from '@/components/shared/ViewPills';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useAddTask } from '@/hooks/api/useAddTask';
import { useLines } from '@/hooks/api/useLines';
import { useMoveTask } from '@/hooks/api/useMoveTask';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useBoardDrag } from '@/hooks/useBoardDrag';
import { useCollapsed } from '@/hooks/useCollapsed';
import {
  BOARD_VIEWS,
  type BoardView,
  inView,
  rememberBoardView,
  rememberedBoardView,
} from '@/lib/board';
import { inboxItemPath } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { stationPath, stationShare } from '@/lib/station';
import { moveTargetFor, type Task, taskPath, tasksAt } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

const STATIONS_STORAGE_KEY = 'spotlight.collapsed-stations';

export function LineBoard() {
  const { slug, teamId, lineId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const lines = useLines(teamId);
  const stations = useCollapsed(STATIONS_STORAGE_KEY);
  const tasks = useTasks(teamId);
  const addTask = useAddTask();
  const moveTask = useMoveTask();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [params, setParams] = useSearchParams();
  const inUrl = params.get('view');
  const view: BoardView = BOARD_VIEWS.some((each) => each.id === inUrl)
    ? (inUrl as BoardView)
    : rememberedBoardView();
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    rememberBoardView(view);
  }, [view]);

  const line = lines.data?.find((candidate) => candidate.id === lineId);
  const standing = tasks.data ?? [];

  const drag = useBoardDrag({
    teamId,
    lineId: line?.id ?? '',
    tasks: standing,
  });

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
    { label: line?.name ?? '' },
  ];
  const { trail, forward } = useTrail(base);

  if (!slug) {
    return null;
  }

  if (failed(lines)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The line"
          retrying={lines.isFetching}
          onRetry={() => void lines.refetch()}
        />
      </PageNotice>
    );
  }

  if (failed(tasks)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The tasks"
          retrying={tasks.isFetching}
          onRetry={() => void tasks.refetch()}
        />
      </PageNotice>
    );
  }

  if (!loading(lines) && !line) {
    return (
      <NotFound title="Line not found" to={teamPath(slug, teamId ?? '')}>
        This team has no line at that address.
      </NotFound>
    );
  }

  const shown = (line?.stations ?? [])
    .map((station, place) => ({ station, place }))
    .filter(({ station }) => inView(view, station.kind));

  const target = line ? moveTargetFor(line.stations, standing, selected) : null;
  const liftedTask = standing.find((each) => each.id === drag.lifted) ?? null;
  const liftedTaskStation = liftedTask
    ? line?.stations.find((each) => each.id === liftedTask.stationId)
    : undefined;

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={
          line ? (
            <Breadcrumbs segments={trail} />
          ) : (
            <TrailSkeleton known={trail.slice(0, -1)} />
          )
        }
      />

      <ViewPills
        views={BOARD_VIEWS}
        current={view}
        onChange={(next) => {
          setParams({ view: next });
          setSelected([]);
        }}
      />

      {!line || loading(tasks) ? (
        <BoardSkeleton />
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <DndContext
            sensors={drag.sensors}
            collisionDetection={drag.collisionDetection}
            {...drag.handlers}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1.5">
              {shown.map(({ station, place }) => (
                <StationSection
                  key={station.id}
                  id={station.id}
                  name={station.name}
                  count={tasksAt(standing, station.id).length}
                  selectedCount={
                    tasksAt(standing, station.id).filter((task) =>
                      selected.includes(task.id),
                    ).length
                  }
                  share={stationShare(place, line.stations.length)}
                  color={station.color}
                  open={stations.isExpanded(station.id)}
                  onToggle={() => stations.toggle(station.id)}
                  onAddTask={() => setAdding(station.id)}
                  landing={
                    drag.landing?.stationId === station.id &&
                    drag.landing.afterTaskId === null &&
                    tasksAt(standing, station.id).length === 0
                  }
                  to={
                    teamId && station.kind === 'work'
                      ? stationPath(slug, teamId, line.id, station.id)
                      : undefined
                  }
                >
                  <SortableContext
                    items={tasksAt(standing, station.id).map((each) => each.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tasksAt(standing, station.id).map(
                      (task, spot, alongside) => {
                        const picked = (candidate?: Task) =>
                          Boolean(candidate && selected.includes(candidate.id));

                        return (
                          <TaskRow
                            key={task.id}
                            task={task}
                            teamId={teamId ?? ''}
                            to={teamId ? taskPath(slug, teamId, task.id) : ''}
                            reviewTo={
                              task.awaitingReview
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
                              picked(task) && picked(alongside[spot - 1])
                            }
                            mergeBottom={
                              picked(task) && picked(alongside[spot + 1])
                            }
                            onSelectedChange={(taken) =>
                              setSelected((current) =>
                                taken
                                  ? [...current, task.id]
                                  : current.filter((each) => each !== task.id),
                              )
                            }
                          />
                        );
                      },
                    )}
                  </SortableContext>
                </StationSection>
              ))}
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
      )}

      {line && (
        <NewTaskDialog
          slug={slug}
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
      )}
    </TrailContext>
  );
}
