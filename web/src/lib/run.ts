import type {
  TaskResponseDto,
  TaskRunResponseDto,
  TeamRunResponseDto,
} from '@/lib/api';
import { counted, type RunJournal } from '@/lib/inbox';

export type Run = TaskRunResponseDto;

export type TeamRun = TeamRunResponseDto;

export type Review = NonNullable<Run['review']>;

export type YourMessage = Run['yourMessage'];

const REFUSED: Partial<Record<YourMessage, string>> = {
  'awaits-another': 'It waits for another person to answer.',
  'not-acting':
    'You do not act on the tasks of this team, so you cannot message it.',
  'moved-on':
    'The task has moved on from this station. Messages here reach no one.',
  'not-on-team':
    'Your message would put the task on hold, and a hold assigns the task to you. Only members of the team can do that.',
};

export const messageRefusal = (yours: YourMessage): string | null =>
  REFUSED[yours] ?? null;

export const LINE_SETS_REPOSITORIES =
  'The line sets the repositories. Change them in the line’s configuration.';

export const formatTokens = (count: number | null): string =>
  count === null ? 'not reported' : counted(count);

export type Progress = NonNullable<TaskResponseDto['progress']>;

export type ShownProgress = Progress | 'finishing';

export const shownProgress = (
  progress: Progress | null,
  runId: string | null,
  journals: readonly {
    readonly runId: string;
    readonly marks: Pick<RunJournal['marks'], 'agentStoppedAt'>;
  }[],
): ShownProgress | null =>
  progress === 'stopping' &&
  journals.some(
    (each) => each.runId === runId && each.marks.agentStoppedAt !== null,
  )
    ? 'finishing'
    : progress;

export const underway = (run: Pick<Run, 'progress'>): boolean =>
  run.progress !== null;

export const newestRunAt = (
  runs: readonly Run[],
  stationId: string,
): Run | null =>
  runs
    .filter((run) => run.station?.id === stationId)
    .reduce<Run | null>(
      (newest, run) =>
        newest && newest.startedAt >= run.startedAt ? newest : run,
      null,
    );

export const stoppable = (
  run: Pick<Run, 'progress' | 'stoppableByYou'>,
): boolean => run.stoppableByYou && run.progress === 'in-progress';

export const idleNoteOf = (run: Pick<Run, 'state'>): string =>
  run.state === 'failed'
    ? 'The run failed before the agent started.'
    : 'The run ended before the agent started.';

export const waitsOnPerson = (run: Pick<Run, 'state' | 'progress'>): boolean =>
  run.state === 'suspended' && run.progress === null;

export const runStatus = (run: Run): string | null => {
  if (run.waitingForYou) {
    return 'Waiting for you';
  }
  if (run.state === 'cancelled') {
    return 'Cancelled';
  }
  if (run.state === 'superseded') {
    return 'Superseded';
  }

  return null;
};

type RanOn = NonNullable<Run['ranOn']>;

type WaitReason = NonNullable<Run['waiting']>['reason'];

export type RunnerPlace = {
  readonly label: string;
  readonly place: string;
  readonly key: string | null;
};

// The platform pool is not one of the pools of the workspace, so it is named apart from them.
export const runnerPlace = (
  run: Pick<Run, 'state' | 'ranOn'>,
): RunnerPlace | null => {
  const ranOn: RanOn | null = run.ranOn;

  if (!ranOn || run.state === 'queued') {
    return null;
  }

  const label = run.state === 'claimed' ? 'Runs on' : 'Ran on';

  if (ranOn.platform) {
    return { label, place: 'Spotlight platform pool', key: null };
  }

  return {
    label,
    place: ranOn.kind === 'pool' ? 'your pool' : 'your trust',
    key: ranOn.key,
  };
};

const WAIT_REASONS: Readonly<Record<WaitReason, string>> = {
  'hosts-pull':
    'Only the hosts of a pull pool or a trust can take this run. It starts when one of these hosts takes it.',
  'no-pool-has-room':
    'The pools that can take this run are full. It starts when one of them has space.',
  'platform-pool-not-allowed':
    'Only the platform pool can take this run, and the operator of this deployment does not let it take this kind of run.',
  'no-pool-matches':
    'No pool can take this run. Add a pool that has the labels and the image that the run needs.',
};

export const waitReason = (
  run: Pick<Run, 'state' | 'waiting'>,
): string | null =>
  run.state === 'queued' && run.waiting
    ? WAIT_REASONS[run.waiting.reason]
    : null;

export const formatImage = (image: string): string =>
  image.replace(/@sha256:([0-9a-f]{12})[0-9a-f]{52}$/, '@sha256:$1');

export const runPath = (slug: string, teamId: string, runId: string): string =>
  `/w/${slug}/team/${teamId}/runs/${encodeURIComponent(runId)}`;

const DAY = 24 * 60 * 60 * 1000;

const midnight = (at: Date): number =>
  new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();

export const aged = (at: string): string => {
  const days = Math.round(
    (midnight(new Date()) - midnight(new Date(at))) / DAY,
  );

  if (days <= 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Yesterday';
  }
  if (days < 14) {
    return `${days} days ago`;
  }
  if (days < 56) {
    return `${Math.floor(days / 7)} weeks ago`;
  }

  const months = Math.floor(days / 30);
  return months <= 1 ? 'A month ago' : `${months} months ago`;
};

export const byAge = <T extends { startedAt: string }>(
  runs: readonly T[],
): [string, T[]][] => {
  const grouped: [string, T[]][] = [];

  for (const run of runs) {
    const label = aged(run.startedAt);
    const last = grouped[grouped.length - 1];

    if (last && last[0] === label) {
      last[1].push(run);
    } else {
      grouped.push([label, [run]]);
    }
  }

  return grouped;
};

export const RUN_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'waiting-for-you', label: 'Waiting for you' },
] as const;

export type RunFilter = (typeof RUN_FILTERS)[number]['id'];

export const ALL_RUNS: RunFilter = 'all';

export const asRunFilter = (raw: string): RunFilter =>
  RUN_FILTERS.some((filter) => filter.id === raw)
    ? (raw as RunFilter)
    : ALL_RUNS;

export const inRunFilter = (
  filter: RunFilter,
  run: Pick<TeamRun, 'waitingForYou'>,
): boolean => filter === 'all' || run.waitingForYou;
