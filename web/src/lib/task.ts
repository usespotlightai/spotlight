import type { StationResponseDto, TaskResponseDto } from '@/lib/api';
import { stationShare } from '@/lib/station';
import { teamPath } from '@/lib/team';

export type Task = TaskResponseDto;

export type NewTask = {
  readonly title: string;
  readonly description: string;
  readonly attachments: string[];
};

export const taskPath = (
  slug: string,
  teamId: string,
  taskId: string,
): string => `${teamPath(slug, teamId)}/tasks/${taskId}`;

export const taskTracePath = (
  slug: string,
  teamId: string,
  taskId: string,
): string => `${taskPath(slug, teamId, taskId)}/trace`;

export const tasksAt = (
  tasks: readonly Task[] | undefined,
  stationId: string,
): Task[] => (tasks ?? []).filter((each) => each.stationId === stationId);

export const raisedOn = (createdAt: string): string => {
  const raised = new Date(createdAt);
  const thisYear = raised.getFullYear() === new Date().getFullYear();

  return raised.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(thisYear ? {} : { year: 'numeric' }),
  });
};

export const startsAgainOnMessage = (
  task: Task | undefined,
  currentStation:
    | { readonly id: string; readonly harness: string | null }
    | undefined,
  ranAt: string | undefined,
): boolean =>
  Boolean(
    task &&
      currentStation?.harness &&
      currentStation.id === ranAt &&
      !task.running &&
      !task.awaitingReview,
  );

type Placed = {
  readonly id: string;
  readonly kind: StationResponseDto['kind'];
};

export const movableByHand = (from: Placed, to: Placed): boolean =>
  from.id === to.id ||
  (from.kind !== 'completed' &&
    (to.kind === 'completed' ||
      (from.kind === 'backlog' && to.kind === 'work') ||
      (from.kind === 'work' && to.kind === 'backlog')));

export const mayLand = (
  stations: readonly Placed[],
  task: Task,
  stationId: string,
): boolean => {
  const from = stations.find((each) => each.id === task.stationId);
  const to = stations.find((each) => each.id === stationId);

  return Boolean(from && to && movableByHand(from, to));
};

type Station = Placed & { readonly name: string };

export type MoveTarget = Station & { readonly share: number };

export const moveTargetFor = (
  stations: readonly Station[],
  tasks: readonly Task[],
  selected: readonly string[],
): MoveTarget | null => {
  const backlog = stations.find((each) => each.kind === 'backlog');
  const start = stations.find((each) => each.kind === 'work');
  const chosen = new Set(selected);
  const picked = tasks.filter((each) => chosen.has(each.id));

  if (!backlog || !start || picked.length === 0) {
    return null;
  }

  const waiting = picked.every((each) => each.stationId === backlog.id);
  const station = waiting ? start : backlog;

  if (!picked.every((each) => mayLand(stations, each, station.id))) {
    return null;
  }

  return {
    ...station,
    share: stationShare(
      stations.findIndex((each) => each.id === station.id),
      stations.length,
    ),
  };
};

export const placed = (
  tasks: readonly Task[],
  taskId: string,
  stationId: string,
  afterTaskId: string | null,
): Task[] => {
  const moving = tasks.find((each) => each.id === taskId);

  if (!moving) {
    return [...tasks];
  }

  const rest = tasks.filter((each) => each.id !== taskId);
  const landed = { ...moving, stationId };

  if (!afterTaskId) {
    const first = rest.findIndex((each) => each.stationId === stationId);
    const at = first === -1 ? rest.length : first;
    return [...rest.slice(0, at), landed, ...rest.slice(at)];
  }

  const after = rest.findIndex((each) => each.id === afterTaskId);
  const at = after === -1 ? rest.length : after + 1;

  return [...rest.slice(0, at), landed, ...rest.slice(at)];
};
