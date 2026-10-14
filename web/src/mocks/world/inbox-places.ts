import type {
  InboxStationResponseDto,
  TaskResponseDto,
  TaskRunResponseDto,
} from '@/lib/api';
import { GROWTH_LINES, GROWTH_RUNS, GROWTH_TASKS } from '@/mocks/world/growth';
import {
  PLATFORM_LINES,
  PLATFORM_RUNS,
  PLATFORM_TASKS,
} from '@/mocks/world/platform';

const MINUTE = 60_000;

const LINES = [...PLATFORM_LINES, ...GROWTH_LINES];

const RUNS: Record<string, TaskRunResponseDto[]> = {
  ...PLATFORM_RUNS,
  ...GROWTH_RUNS,
};

const TASKS: TaskResponseDto[] = [...PLATFORM_TASKS, ...GROWTH_TASKS];

export const runsOfTask = (taskId: string): TaskRunResponseDto[] =>
  RUNS[taskId] ?? [];

const seededRun = (runId: string): TaskRunResponseDto => {
  const found = Object.values(RUNS)
    .flat()
    .find((run) => run.id === runId);

  if (!found) {
    throw new Error(`The mock world has no run ${runId}`);
  }

  return found;
};

export const seededTask = (taskId: string): TaskResponseDto => {
  const found = TASKS.find((task) => task.id === taskId);

  if (!found) {
    throw new Error(`The mock world has no task ${taskId}`);
  }

  return found;
};

export const taskOfSeededRun = (runId: string): string => {
  const found = Object.entries(RUNS).find(([, runs]) =>
    runs.some((run) => run.id === runId),
  );

  if (!found) {
    throw new Error(`The mock world has no run ${runId}`);
  }

  return found[0];
};

export const stationOfRun = (runId: string): string => {
  const station = seededRun(runId).station;

  if (!station) {
    throw new Error(`The mock world has no station for run ${runId}`);
  }

  return station.id;
};

export const runEnded = (runId: string): string => seededRun(runId).updatedAt;

export const minutesAfter = (at: string, minutes: number): string =>
  new Date(Date.parse(at) + minutes * MINUTE).toISOString();

export type InboxPlace = InboxStationResponseDto & { readonly count: number };

export const placeOf = (stationId: string): InboxPlace => {
  const line = LINES.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );
  const station = line?.stations.find((each) => each.id === stationId);

  if (!line || !station) {
    throw new Error(`The mock world has no station ${stationId}`);
  }

  return {
    name: station.name,
    color: station.color,
    position: station.position,
    count: line.stations.length,
  };
};

export const lineOfStation = (stationId: string): string => {
  const line = LINES.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );

  if (!line) {
    throw new Error(`The mock world has no station ${stationId}`);
  }

  return line.id;
};
