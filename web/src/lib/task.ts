import type { TaskResponseDto } from '@/lib/api';
import { stationShare } from '@/lib/station';
import { teamPath, teamSectionPath } from '@/lib/team';

export type Task = TaskResponseDto;

export type NewTask = {
  readonly title: string;
  readonly description: string;
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
): string =>
  `${teamSectionPath(slug, teamId, 'observability')}/tasks/${taskId}`;

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

type Station = { readonly id: string; readonly name: string };

export type MoveTarget = Station & { readonly share: number };

export const moveTargetFor = (
  stations: readonly Station[],
  tasks: readonly Task[],
  selected: readonly string[],
): MoveTarget | null => {
  const [first, second] = stations;

  if (!first || !second || selected.length === 0) {
    return null;
  }

  const standing = tasks.filter((each) => selected.includes(each.id));
  const allAtFirst = standing.every((each) => each.stationId === first.id);
  const station = allAtFirst ? second : first;

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
