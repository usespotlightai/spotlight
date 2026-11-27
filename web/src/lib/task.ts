import type {
  StationResponseDto,
  TaskHandMoveResponseDto,
  TaskResponseDto,
} from '@/lib/api';
import { formatDate } from '@/lib/date-format';
import { nonEmpty } from '@/lib/non-empty';
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

export const createdOn = (createdAt: string): string => {
  const created = new Date(createdAt);
  const thisYear = created.getFullYear() === new Date().getFullYear();

  return formatDate(created, {
    month: 'short',
    day: 'numeric',
    ...(thisYear ? {} : { year: 'numeric' }),
  });
};

type Placed = {
  readonly id: string;
  readonly kind: StationResponseDto['kind'];
};

type HandMove = TaskHandMoveResponseDto;

type Denial = NonNullable<HandMove['denial']>;

const DENIALS: Record<Denial, string> = {
  'between-work-stations': 'Only runs move it here',
  'out-of-completed': 'A completed task stays completed',
  'on-hold': 'On hold for someone else',
};

const NAMES = new Intl.ListFormat('en', { type: 'conjunction' });

const handMoveTo = (task: Task, stationId: string): HandMove | undefined =>
  task.handMoves.find((each) => each.stationId === stationId);

export const mayLand = (task: Task, stationId: string): boolean =>
  handMoveTo(task, stationId)?.denial === null;

export const handMoveHint = (
  move: HandMove,
  stations: readonly { readonly id: string; readonly name: string }[],
): string | null => {
  if (move.denial) {
    return DENIALS[move.denial];
  }
  if (move.sendsBack) {
    return 'Sends it back with a reason';
  }

  const skips = new Set(move.skips);
  const skipped = stations
    .filter((each) => skips.has(each.id))
    .map((each) => each.name);

  return skipped.length > 0 ? `Skips ${NAMES.format(skipped)}` : null;
};

export const handMoveDenial = (task: {
  readonly stationId: string;
  readonly handMoves: readonly HandMove[];
}): string | null => {
  const denials = task.handMoves
    .filter((each) => each.stationId !== task.stationId)
    .map((each) => each.denial);
  const [first] = denials;

  return first && denials.every(Boolean) ? DENIALS[first] : null;
};

export const stopsRun = (
  stations: readonly Placed[],
  task: Task,
  stationId: string,
): boolean =>
  task.progress === 'in-progress' &&
  task.stationId !== stationId &&
  stations.find((each) => each.id === stationId)?.kind === 'completed';

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

  if (!picked.every((each) => mayLand(each, station.id))) {
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

  if (!nonEmpty(afterTaskId)) {
    const first = rest.findIndex((each) => each.stationId === stationId);
    const at = first === -1 ? rest.length : first;
    return [...rest.slice(0, at), landed, ...rest.slice(at)];
  }

  const after = rest.findIndex((each) => each.id === afterTaskId);
  const at = after === -1 ? rest.length : after + 1;

  return [...rest.slice(0, at), landed, ...rest.slice(at)];
};
