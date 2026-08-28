import type { TaskResponseDto } from '@/lib/api';
import { stationShare } from '@/lib/station';
import { teamPath } from '@/lib/team';

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
