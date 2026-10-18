import type {
  FailureCauseResponseDto,
  FieldErrorResponseDto,
  LineReplayCheckResponseDto,
  ReflectedTaskResponseDto,
  ReplayCheckSummaryResponseDto,
  SearchAgentRequestDto,
  SearchBestResponseDto,
  SearchBudgetRequestDto,
  SearchCandidateResponseDto,
  SearchDetailResponseDto,
  SearchEstimateResponseDto,
  SearchIterationResponseDto,
  SearchResponseDto,
  SearchRunResponseDto,
} from '@/lib/api';
import { messageOf } from '@/lib/error';
import { spentIn } from '@/lib/inbox';
import { formatDuration } from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import {
  type CountBounds,
  ceilingFrom,
  countFrom,
  REPEAT_BOUNDS,
  type ReplayedStation,
  type ReplaySet,
} from '@/lib/replay';
import { minGainSentence, STATION_GONE_FROM_LINE } from '@/lib/replay-words';
import type { CauseKind, SearchState } from '@/lib/search-words';
import { stationPath, stationTabPath } from '@/lib/station';
import { type ConfigChange, configChangesOf } from '@/lib/station-config';

export type Search = SearchResponseDto;
export type SearchDetail = SearchDetailResponseDto;
export type SearchCandidate = SearchCandidateResponseDto;
type SearchIteration = SearchIterationResponseDto;
export type SearchEstimate = SearchEstimateResponseDto;
export type SearchBudget = SearchBudgetRequestDto;
export type SearchAgent = SearchAgentRequestDto;
export type SearchRun = SearchRunResponseDto;
export type ReplayCheckSummary = ReplayCheckSummaryResponseDto;
export type LineReplayCheck = LineReplayCheckResponseDto;

export const CHECKS_PAGE = 50;

export const SEARCHES_ANCHOR = 'searches';

export const SEED_NAME = 'seed';

const MIN_TASKS = 5;

export const DEFAULT_CONCURRENCY = 4;

const BOUNDS = {
  iterations: { min: 1, max: 10 },
  perIteration: { min: 1, max: 5 },
  concurrency: { min: 1, max: 10 },
  repeats: REPEAT_BOUNDS,
} as const satisfies Record<string, CountBounds>;

type BudgetCount = keyof typeof BOUNDS;
type BudgetField = BudgetCount | 'ceiling';
export type SearchField = BudgetField | 'set' | 'agent';

export type BudgetInputs = {
  readonly iterations: string;
  readonly perIteration: string;
  readonly concurrency: string;
  readonly repeats: string;
  readonly amount: string;
  readonly currency: string;
};

export type FieldProblems = Partial<Record<SearchField, string>>;

export const typedIn = (inputs: BudgetInputs, field: SearchField): boolean => {
  if (field === 'ceiling') {
    return inputs.amount.trim() !== '';
  }

  return Object.hasOwn(BOUNDS, field)
    ? inputs[field as BudgetCount].trim() !== ''
    : false;
};

export const searchPath = (at: ReplayedStation, searchId: string): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}/searches/${encodeURIComponent(searchId)}`;

export const searchCandidateAnchor = (candidateId: string): string =>
  `candidate-${candidateId}`;

export const searchCandidatePath = (
  at: ReplayedStation,
  searchId: string,
  candidateId: string,
): string =>
  `${searchPath(at, searchId)}#${searchCandidateAnchor(candidateId)}`;

export const searchesAnchorPath = (at: ReplayedStation): string =>
  `${stationTabPath(at.slug, at.teamId, at.lineId, at.stationId, 'improve')}#${SEARCHES_ANCHOR}`;

export const ongoing = (state: SearchState): boolean =>
  state === 'seeding' || state === 'searching' || state === 'holding-out';

export const ongoingIn = (searches: readonly Search[]): Search | null =>
  searches.find((each) => ongoing(each.state)) ?? null;

export const candidatesOf = (detail: SearchDetail): SearchCandidate[] => [
  detail.seed,
  ...detail.candidates,
];

export const stillMoving = (detail: SearchDetail): boolean =>
  ongoing(detail.state) ||
  candidatesOf(detail).some((each) => each.pullRequest?.state === 'opening');

export const newestFirst = (searches: readonly Search[]): Search[] =>
  [...searches].sort((one, other) =>
    other.startedAt.localeCompare(one.startedAt),
  );

export const searchNumber = (
  searches: readonly Search[],
  searchId: string,
): number | null => {
  const place = [...searches]
    .sort((one, other) => one.startedAt.localeCompare(other.startedAt))
    .findIndex((each) => each.id === searchId);

  return place < 0 ? null : place + 1;
};

export const searchLabel = (number: number | null): string =>
  number === null ? 'Search' : `Search ${number}`;

export const iterationTitle = (
  iteration: number,
  number: number | null,
): string => `Iteration ${iteration} of ${searchLabel(number)}`;

export const tasksIn = (set: ReplaySet): number =>
  new Set(set.entries.map((each) => each.taskId)).size;

const formatTasks = (count: number): string =>
  count === 1 ? '1 task' : `${count} tasks`;

export const setProblemOf = (set: ReplaySet): string | null => {
  if (set.stationGone) {
    return STATION_GONE_FROM_LINE;
  }

  const tasks = tasksIn(set);

  return tasks < MIN_TASKS
    ? `The set covers ${formatTasks(tasks)}. A search holds some tasks out. Minimum different tasks: ${MIN_TASKS}`
    : null;
};

export const startProblem = (
  sets: readonly ReplaySet[],
  inProgress: Search | null,
): string | null => {
  if (inProgress) {
    return 'A search of this station is in progress.';
  }
  if (sets.length === 0) {
    return 'Create a replay set first.';
  }

  return sets.some((set) => setProblemOf(set) === null)
    ? null
    : `No replay set covers ${MIN_TASKS} different tasks yet.`;
};

export const budgetFrom = (
  inputs: BudgetInputs,
): { budget: SearchBudget | null; problems: FieldProblems } => {
  const iterations = countFrom(inputs.iterations, BOUNDS.iterations);
  const perIteration = countFrom(inputs.perIteration, BOUNDS.perIteration);
  const concurrency = countFrom(inputs.concurrency, BOUNDS.concurrency);
  const repeats = countFrom(inputs.repeats, BOUNDS.repeats);
  const ceiling = ceilingFrom(inputs.amount, inputs.currency);
  const problems: FieldProblems = {
    ...(typeof iterations === 'string' ? { iterations } : {}),
    ...(typeof perIteration === 'string' ? { perIteration } : {}),
    ...(typeof concurrency === 'string' ? { concurrency } : {}),
    ...(typeof repeats === 'string' ? { repeats } : {}),
    ...(typeof ceiling === 'string' ? { ceiling } : {}),
  };

  if (
    typeof iterations === 'string' ||
    typeof perIteration === 'string' ||
    typeof concurrency === 'string' ||
    typeof repeats === 'string' ||
    typeof ceiling === 'string'
  ) {
    return { budget: null, problems };
  }

  return {
    budget: { iterations, perIteration, concurrency, repeats, ceiling },
    problems,
  };
};

const FIELDS: readonly [prefix: string, field: SearchField][] = [
  ['budget.iterations', 'iterations'],
  ['budget.perIteration', 'perIteration'],
  ['budget.concurrency', 'concurrency'],
  ['budget.repeats', 'repeats'],
  ['budget.ceiling', 'ceiling'],
  ['agent', 'agent'],
  ['setId', 'set'],
];

export const fieldOf = (path: string): SearchField | null =>
  FIELDS.find(
    ([prefix]) =>
      path === prefix ||
      path.startsWith(`${prefix}.`) ||
      path.startsWith(`${prefix}[`),
  )?.[1] ?? null;

const fieldErrorsOf = (thrown: unknown): FieldErrorResponseDto[] => {
  const errors = (thrown as { errors?: unknown } | null)?.errors;

  return Array.isArray(errors) ? (errors as FieldErrorResponseDto[]) : [];
};

export const problemsOf = (
  thrown: unknown,
): { fields: FieldProblems; general: string | null } => {
  if (!thrown) {
    return { fields: {}, general: null };
  }

  const fields: FieldProblems = {};
  const unplaced: string[] = [];

  for (const error of fieldErrorsOf(thrown)) {
    if (error.severity !== 'error') {
      continue;
    }

    const field = fieldOf(error.path);

    if (field && !fields[field]) {
      fields[field] = error.message;
    } else if (!field) {
      unplaced.push(error.message);
    }
  }

  const placed = Object.keys(fields).length > 0;

  return {
    fields,
    general:
      unplaced.length > 0
        ? unplaced.join(' ')
        : placed
          ? null
          : messageOf(
              thrown,
              'Sorry, the search couldn’t be started. Please try again later.',
            ),
  };
};

export const formatCostPerRun = (
  cost: number | null,
  currency: string,
): string => (cost === null ? 'Unpriced' : spentIn(cost, currency));

export const formatHeldOut = (candidate: SearchCandidate): string => {
  if (candidate.isSeed) {
    return '–';
  }
  if (
    candidate.heldOutReplayState === 'queued' ||
    candidate.heldOutReplayState === 'running'
  ) {
    return 'Replaying';
  }

  return candidate.heldOutReplayId ? '–' : 'Not held out';
};

export const formatEstimatedDuration = (ms: number | null): string =>
  ms === null
    ? 'Unknown. None of the set’s runs was timed.'
    : `About ${formatDuration(ms)}`;

export const searchChanges = (candidate: SearchCandidate): ConfigChange[] =>
  configChangesOf(candidate.changes);

export const pickProblem = (candidate: SearchCandidate): string | null => {
  if (candidate.isSeed) {
    return 'The station already runs the live config.';
  }

  switch (candidate.replayState) {
    case 'finished':
      return null;
    case 'stopped':
      return 'You can’t pick this candidate. Its replay stopped before it finished.';
    case 'ceiling-reached':
      return 'You can’t pick this candidate. Its replay reached its ceiling before it finished.';
    case null:
      return 'You can’t pick this candidate. Its replay is gone.';
    default:
      return 'After its replay on the searched tasks finishes, you can pick this candidate.';
  }
};

export type IterationGroup = {
  readonly number: number;
  readonly iteration: SearchIteration | null;
  readonly candidates: readonly SearchCandidate[];
};

export const byIteration = (detail: SearchDetail): IterationGroup[] => {
  const numbers = new Set<number>([
    ...detail.iterations.map((each) => each.number),
    ...detail.candidates.flatMap((each) =>
      each.iteration === null ? [] : [each.iteration],
    ),
  ]);

  return [...numbers]
    .sort((one, other) => one - other)
    .map((number) => ({
      number,
      iteration:
        detail.iterations.find((each) => each.number === number) ?? null,
      candidates: detail.candidates.filter((each) => each.iteration === number),
    }));
};

type FailureCause = FailureCauseResponseDto;
export type ReflectedTask = ReflectedTaskResponseDto;

const CAUSE_ORDER: readonly CauseKind[] = [
  'task',
  'judge',
  'check',
  'infra',
  'config',
];

export const whyItStalledAnchor = (iteration: number): string =>
  `why-it-stalled-${iteration}`;

export const reflectionsOf = (detail: SearchDetail): SearchIteration[] =>
  detail.iterations
    .filter((each) => each.kind === 'reflect')
    .sort((one, other) => other.number - one.number);

export const reflecting = (iteration: SearchIteration): boolean =>
  !iteration.reflection?.result;

export const incumbentOf = (
  detail: SearchDetail,
  iteration: SearchIteration,
): SearchCandidate | null =>
  candidatesOf(detail).find(
    (each) => each.candidateId === iteration.reflection?.incumbent,
  ) ?? null;

export type CauseGroup = {
  readonly cause: CauseKind;
  readonly causes: readonly FailureCause[];
};

export const causesByKind = (iteration: SearchIteration): CauseGroup[] => {
  const causes = iteration.reflection?.causes ?? [];

  return CAUSE_ORDER.map((cause) => ({
    cause,
    causes: causes.filter((each) => each.cause === cause),
  })).filter((group) => group.causes.length > 0);
};

export const uncausedTasks = (iteration: SearchIteration): ReflectedTask[] => {
  const reflection = iteration.reflection;

  if (!reflection || reflecting(iteration)) {
    return [];
  }

  const caused = new Set(reflection.causes.map((each) => each.taskId));

  return reflection.tasks.filter((each) => !caused.has(each.taskId));
};

export type FrontierPoint = {
  readonly id: string;
  readonly name: string;
  readonly seed: boolean;
  readonly success: number;
  readonly cost: number;
  readonly frontier: boolean;
};

const chartStatus = (candidate: SearchCandidate): boolean =>
  candidate.isSeed || candidate.replayState === 'finished';

export const frontierPoints = (
  detail: SearchDetail,
): {
  priced: FrontierPoint[];
  unpriced: SearchCandidate[];
} => {
  const scored = candidatesOf(detail).filter(
    (each) => each.searchScore !== null,
  );
  const finished = scored.filter(chartStatus);

  return {
    priced: finished.flatMap((each) =>
      each.searchScore !== null && each.costPerRun !== null
        ? [
            {
              id: each.candidateId,
              name: candidateName(each),
              seed: each.isSeed,
              success: each.searchScore,
              cost: each.costPerRun,
              frontier: each.onFrontier,
            },
          ]
        : [],
    ),
    unpriced: finished.filter((each) => each.costPerRun === null),
  };
};

export const candidateName = (candidate: SearchCandidate): string =>
  candidate.isSeed ? 'Live config' : candidate.name;

export const setTaskTitle = (
  entry: { readonly runId: string; readonly taskId: string },
  set: ReplaySet | undefined,
): string =>
  set?.entries.find((each) => each.runId === entry.runId)?.title ??
  `Task ${entry.taskId.slice(0, 8)}`;

export const agentOf = (
  harness: string,
  model: string,
  effort: string,
): SearchAgent => ({
  harness,
  model: model || null,
  ...(effort ? { effort: effort as SearchAgent['effort'] } : {}),
});

export const formatReference = (
  reference: ReplayCheckSummary['reference'],
): string | null => {
  if (reference.pullRequest !== null) {
    return `Pull request #${reference.pullRequest}`;
  }

  return reference.commit ? `Commit ${reference.commit.slice(0, 7)}` : null;
};

const formatRegressions = (count: number): string =>
  count === 1 ? '1 regression' : `${count} regressions`;

export const appPathOf = (url: string): string => {
  const parsed = new URL(url, 'http://spotlight.invalid');

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export type BestScore = {
  readonly rate: number | null;
  readonly interval: SearchBestResponseDto['searchInterval'];
  readonly heldOut: boolean;
};

export const bestScoreOf = (best: SearchBestResponseDto): BestScore => {
  const heldOut = best.heldOutScore !== null;

  return heldOut
    ? { rate: best.heldOutScore, interval: best.heldOutInterval, heldOut }
    : { rate: best.searchScore, interval: best.searchInterval, heldOut };
};

export const SEARCH_HEADINGS: readonly NestedHeading[] = [
  { label: 'Search', indent: 'edge', size: SPREAD },
  { label: 'State', size: SPREAD },
  { label: 'Replay set', size: SPREAD },
  { label: 'Best', size: 'minmax(8rem,2fr)' },
  { label: 'Success', numeric: true, size: SPREAD },
  { label: 'Iterations', numeric: true, size: SPREAD },
  { label: 'Spent', numeric: true, size: SPREAD },
  { label: 'Started', numeric: true, size: SPREAD },
];

const GATE_NOTE =
  'spotlight replay check replays a pull request’s change of this station on this set. One gating set per station.';

export const replayCheckNote = (
  replayCheck: LineReplayCheck | null | undefined,
): string => {
  if (replayCheck === undefined) {
    return GATE_NOTE;
  }
  if (replayCheck === null) {
    return `${GATE_NOTE} Line sets no replay_check. Its pull requests aren’t checked.`;
  }

  return `${GATE_NOTE} Fails past ${formatRegressions(replayCheck.maxRegressions)}. Ceiling per check: ${spentIn(replayCheck.ceiling, replayCheck.currency)} · ${minGainSentence(replayCheck.minGain)}`;
};

export const SEARCH_CANDIDATE_HEADINGS: readonly NestedHeading[] = [
  { label: 'Candidate', indent: 'edge', size: 'minmax(10rem,3fr)' },
  { label: 'Searched', numeric: true, size: SPREAD },
  { label: 'Held out', numeric: true, size: SPREAD },
  { label: 'Gain', numeric: true, size: SPREAD },
  { label: 'Cost per run', numeric: true, size: SPREAD },
  { label: 'Pull request', size: SPREAD },
];
