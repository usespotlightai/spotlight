import type {
  TaskResponseDto,
  TaskRunResponseDto,
  TeamRunResponseDto,
} from '@/lib/api';
import { GROWTH_LINES, GROWTH_TASKS } from '@/mocks/world/growth';
import {
  type History,
  type HistoryRun,
  type HistoryTask,
  history,
} from '@/mocks/world/insights-history';
import { pullRequestUrlOf } from '@/mocks/world/insights-pull-requests';
import { PEOPLE, SAM } from '@/mocks/world/people';
import { PLATFORM_LINES, PLATFORM_TASKS } from '@/mocks/world/platform';
import { runStationOf } from '@/mocks/world/stations';

const LINES = [...PLATFORM_LINES, ...GROWTH_LINES];

const CORE_TASKS = new Set(
  [...PLATFORM_TASKS, ...GROWTH_TASKS].map((task) => task.id),
);

export const isCoreTask = (taskId: string): boolean => CORE_TASKS.has(taskId);

type Index = {
  readonly runs: Map<string, HistoryRun>;
  readonly byTask: Map<string, HistoryRun[]>;
  readonly tasks: Map<string, HistoryTask>;
  readonly visits: Map<string, number>;
  readonly shownTasks: Map<string, TaskResponseDto>;
  readonly teamRuns: Map<string, TeamRunResponseDto[]>;
};

let indexed: { readonly source: History; readonly index: Index } | null = null;

const indexOf = (source: History): Index => {
  const byTask = new Map<string, HistoryRun[]>();
  const visits = new Map<string, number>();

  for (const run of [...source.runs].sort((one, other) => one.at - other.at)) {
    const earlier = byTask.get(run.taskId) ?? [];
    visits.set(
      run.runId,
      earlier.filter((each) => each.stationId === run.stationId).length + 1,
    );
    byTask.set(run.taskId, [...earlier, run]);
  }

  return {
    runs: new Map(source.runs.map((run) => [run.runId, run])),
    byTask,
    tasks: new Map(source.tasks.map((task) => [task.id, task])),
    visits,
    shownTasks: new Map(),
    teamRuns: new Map(),
  };
};

const index = (): Index => {
  const source = history();
  if (indexed?.source !== source) {
    indexed = { source, index: indexOf(source) };
  }
  return indexed.index;
};

export const historyRunOf = (runId: string): HistoryRun | undefined =>
  index().runs.get(runId);

export const historyRunsOfTask = (taskId: string): readonly HistoryRun[] =>
  index().byTask.get(taskId) ?? [];

export const historyTaskOf = (taskId: string): HistoryTask | undefined =>
  index().tasks.get(taskId);

export const visitOf = (runId: string): number =>
  index().visits.get(runId) ?? 1;

export const lineOfStation = (stationId: string) =>
  LINES.find((line) => line.stations.some((each) => each.id === stationId));

export const stationOfId = (stationId: string) =>
  lineOfStation(stationId)?.stations.find((each) => each.id === stationId);

const personOf = (id: string) =>
  PEOPLE.find((person) => person.id === id) ?? SAM;

const stateOf = (run: HistoryRun): TaskRunResponseDto['state'] =>
  run.ending === 'completed' ? 'completed' : 'failed';

const exitCodeOf = (run: HistoryRun): number | null =>
  run.ending === 'completed' ? 0 : run.ending === 'failed' ? 1 : null;

const shownRunOf = (run: HistoryRun): TaskRunResponseDto => ({
  id: run.runId,
  state: stateOf(run),
  attempt: visitOf(run.runId),
  exitCode: exitCodeOf(run),
  startedAt: run.startedAt ?? run.endedAt ?? new Date(run.at).toISOString(),
  updatedAt: run.endedAt ?? new Date(run.at).toISOString(),
  harness: run.harness ?? 'claude-code',
  image: null,
  station: runStationOf(
    lineOfStation(run.stationId)?.stations ?? [],
    run.stationId,
  ),
  review: null,
});

const finalStationOf = (runs: readonly HistoryRun[]): string => {
  const last = runs.at(-1);
  return last?.passed?.to ?? last?.stationId ?? '';
};

const shownTaskOf = (task: HistoryTask): TaskResponseDto => ({
  id: task.id,
  stationId: finalStationOf(historyRunsOfTask(task.id)),
  revision: 0,
  title: task.title,
  description: null,
  attachments: [],
  createdAt: new Date(task.openedAt).toISOString(),
  running: false,
  queued: false,
  awaitingReview: null,
  pullRequest: task.pullRequest ? pullRequestUrlOf(task.teamId, task.id) : null,
  createdBy: personOf(task.openedBy),
  assignee: null,
  note: null,
});

export const pastTaskOf = (taskId: string): TaskResponseDto | undefined => {
  if (isCoreTask(taskId)) {
    return undefined;
  }
  const { tasks, shownTasks } = index();
  const found = tasks.get(taskId);
  if (!found) {
    return undefined;
  }
  const shown = shownTasks.get(taskId) ?? shownTaskOf(found);
  shownTasks.set(taskId, shown);
  return shown;
};

export const teamOfPastTask = (taskId: string): string | undefined =>
  isCoreTask(taskId) ? undefined : historyTaskOf(taskId)?.teamId;

export const pastRunsOfTask = (taskId: string): TaskRunResponseDto[] =>
  isCoreTask(taskId) ? [] : historyRunsOfTask(taskId).map(shownRunOf).reverse();

export const pastTeamRuns = (teamId: string): TeamRunResponseDto[] => {
  const { teamRuns } = index();
  const found = teamRuns.get(teamId);
  if (found) {
    return found;
  }
  const made = history()
    .runs.filter((run) => run.teamId === teamId && !isCoreTask(run.taskId))
    .map((run): TeamRunResponseDto => {
      const task = pastTaskOf(run.taskId);
      return {
        ...shownRunOf(run),
        taskId: run.taskId,
        taskTitle: task?.title ?? null,
        taskDescription: task?.description ?? null,
      };
    });
  teamRuns.set(teamId, made);
  return made;
};
