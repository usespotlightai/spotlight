import type {
  ImprovementFreshResponseDto,
  ImprovementRunResponseDto,
  ImprovementScoringResponseDto,
  ImprovementSearchResponseDto,
  ImprovementSetResponseDto,
  StationImprovementResponseDto,
} from '@/lib/api';
import { formatDate } from '@/lib/date-format';

export type StationImprovement = StationImprovementResponseDto;

export type ImprovementSearch = ImprovementSearchResponseDto;

export type ImprovementRun = ImprovementRunResponseDto;

type SearchState = ImprovementSearch['state'];

type SearchTrigger = ImprovementSearch['trigger'];

const SEARCH_STATES: Record<SearchState, string> = {
  seeding: 'Replaying the live config',
  searching: 'Trying candidates',
  'holding-out': 'Replaying on held-out tasks',
  finished: 'Finished',
  stopped: 'Stopped',
};

const TRIGGERS: Record<SearchTrigger, string> = {
  schedule: 'on schedule',
  alert: 'after an alert',
  request: 'asked for by a person in a chat',
};

const counted = (count: number, one: string, many: string): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

export const formatSearchState = (state: SearchState): string =>
  SEARCH_STATES[state];

export const formatTrigger = (trigger: SearchTrigger): string =>
  TRIGGERS[trigger];

export const formatSetSize = (set: ImprovementSetResponseDto): string =>
  set.bigEnough
    ? counted(set.tasks, 'task', 'tasks')
    : `${set.tasks.toLocaleString()} of ${counted(set.fewestTasks, 'task', 'tasks')}`;

export const formatFreshTasks = (fresh: ImprovementFreshResponseDto): string =>
  fresh.enough
    ? counted(fresh.tasks, 'task', 'tasks')
    : `${fresh.tasks.toLocaleString()} of ${fresh.heldOutTasks.toLocaleString()} needed`;

export const FRESH_TASKS_NOTE =
  'Tasks no earlier search searched on. A search holds some of them out, to check a candidate on tasks its agent never saw.';

export const formatScoring = (
  scoring: ImprovementScoringResponseDto,
): string => {
  if (scoring.judge && scoring.check) {
    return 'Judge and check';
  }
  if (scoring.judge) {
    return 'Judge';
  }

  return scoring.check ? 'Check' : 'No judge or check';
};

const endingOf = (succeeded: boolean | null): string => {
  if (succeeded === null) {
    return 'Ended';
  }

  return succeeded ? 'Succeeded' : 'Failed';
};

export const formatRunProgress = (run: ImprovementRun): string => {
  if (run.progress === 'waiting') {
    return 'Waiting for a runner';
  }

  return run.progress === 'running' ? 'Running' : endingOf(run.succeeded);
};

export const formatWhen = (at: string, now = Date.now()): string =>
  new Date(at).getTime() <= now
    ? 'Now'
    : formatDate(new Date(at), {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

export const replayRunsOf = (search: ImprovementSearch): number =>
  search.replays.reduce((sum, each) => sum + each.runs.length, 0);

export const formatReplayRuns = (search: ImprovementSearch): string => {
  const runs = replayRunsOf(search);
  const ended = search.replays.reduce(
    (sum, each) =>
      sum + each.runs.filter((run) => run.progress === 'ended').length,
    0,
  );

  return `${counted(runs, 'replay run', 'replay runs')}, ${ended.toLocaleString()} ended`;
};
