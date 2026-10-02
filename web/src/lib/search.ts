import type {
  FieldErrorResponseDto,
  LineReplayCheckResponseDto,
  ReplayCheckSummaryResponseDto,
  SearchAgentRequestDto,
  SearchBudgetRequestDto,
  SearchCandidateResponseDto,
  SearchDetailResponseDto,
  SearchEstimateResponseDto,
  SearchIterationResponseDto,
  SearchResponseDto,
  SearchRunResponseDto,
  SearchSplitEntryResponseDto,
} from '@/lib/api';
import { messageOf } from '@/lib/error';
import { spentIn } from '@/lib/inbox';
import { lasted } from '@/lib/insights';
import { percentShown } from '@/lib/judge';
import {
  ceilingFrom,
  type ReplayedStation,
  type ReplaySet,
} from '@/lib/replay';
import type { SearchState } from '@/lib/search-words';
import { stationPath } from '@/lib/station';
import { type ConfigChange, configChangesOf } from '@/lib/station-config';

export type Search = SearchResponseDto;
export type SearchDetail = SearchDetailResponseDto;
export type SearchCandidate = SearchCandidateResponseDto;
type SearchIteration = SearchIterationResponseDto;
export type SearchEstimate = SearchEstimateResponseDto;
export type SearchBudget = SearchBudgetRequestDto;
export type SearchAgent = SearchAgentRequestDto;
export type SplitEntry = SearchSplitEntryResponseDto;
export type SearchRun = SearchRunResponseDto;
export type ReplayCheckSummary = ReplayCheckSummaryResponseDto;
export type LineReplayCheck = LineReplayCheckResponseDto;

export const CHECKS_PAGE = 50;

export const SEARCHES_ANCHOR = 'searches';

export const SEED_NAME = 'seed';

const LEAST_TASKS = 5;

export const DEFAULT_CONCURRENCY = 4;

type Bounds = { readonly least: number; readonly most: number };

const BOUNDS = {
  iterations: { least: 1, most: 10 },
  perIteration: { least: 1, most: 5 },
  concurrency: { least: 1, most: 10 },
} as const satisfies Record<string, Bounds>;

type BudgetCount = keyof typeof BOUNDS;
type BudgetField = BudgetCount | 'ceiling';
export type SearchField = BudgetField | 'set' | 'agent';

export type BudgetInputs = {
  readonly iterations: string;
  readonly perIteration: string;
  readonly concurrency: string;
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

export const searchesAnchorPath = (at: ReplayedStation): string =>
  `${stationPath(at.slug, at.teamId, at.lineId, at.stationId)}#${SEARCHES_ANCHOR}`;

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

export const tasksIn = (set: ReplaySet): number =>
  new Set(set.entries.map((each) => each.taskId)).size;

const tasksShown = (count: number): string =>
  count === 1 ? '1 task' : `${count} tasks`;

export const setRefusal = (set: ReplaySet): string | null => {
  if (set.stationGone) {
    return 'Its station is gone from its line.';
  }

  const tasks = tasksIn(set);

  return tasks < LEAST_TASKS
    ? `It covers ${tasksShown(tasks)}; a search needs runs of at least ${LEAST_TASKS} different tasks, to hold some out.`
    : null;
};

export const startRefusal = (
  sets: readonly ReplaySet[],
  underway: Search | null,
): string | null => {
  if (underway) {
    return 'A search of this station is under way.';
  }
  if (sets.length === 0) {
    return 'Open a replay set first.';
  }

  return sets.some((set) => setRefusal(set) === null)
    ? null
    : `No replay set covers ${LEAST_TASKS} different tasks yet.`;
};

const countFrom = (text: string, { least, most }: Bounds): number | string => {
  const value = Number(text);

  return text.trim() !== '' &&
    Number.isInteger(value) &&
    value >= least &&
    value <= most
    ? value
    : `Give a whole number from ${least} to ${most}.`;
};

export const budgetFrom = (
  inputs: BudgetInputs,
): { budget: SearchBudget | null; problems: FieldProblems } => {
  const iterations = countFrom(inputs.iterations, BOUNDS.iterations);
  const perIteration = countFrom(inputs.perIteration, BOUNDS.perIteration);
  const concurrency = countFrom(inputs.concurrency, BOUNDS.concurrency);
  const ceiling = ceilingFrom(inputs.amount, inputs.currency);
  const problems: FieldProblems = {
    ...(typeof iterations === 'string' ? { iterations } : {}),
    ...(typeof perIteration === 'string' ? { perIteration } : {}),
    ...(typeof concurrency === 'string' ? { concurrency } : {}),
    ...(typeof ceiling === 'string' ? { ceiling } : {}),
  };

  if (
    typeof iterations === 'string' ||
    typeof perIteration === 'string' ||
    typeof concurrency === 'string' ||
    typeof ceiling === 'string'
  ) {
    return { budget: null, problems };
  }

  return {
    budget: { iterations, perIteration, concurrency, ceiling },
    problems,
  };
};

const FIELDS: readonly [prefix: string, field: SearchField][] = [
  ['budget.iterations', 'iterations'],
  ['budget.perIteration', 'perIteration'],
  ['budget.concurrency', 'concurrency'],
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

export const refusalsOf = (
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
          : messageOf(thrown, 'Spotlight would not start the search.'),
  };
};

export const scoreShown = (rate: number | null): string =>
  rate === null ? '–' : percentShown(rate);

export const costPerRunShown = (
  cost: number | null,
  currency: string,
): string => (cost === null ? 'Unpriced' : spentIn(cost, currency));

export const heldOutShown = (candidate: SearchCandidate): string => {
  if (candidate.heldOutScore !== null) {
    return percentShown(candidate.heldOutScore);
  }
  if (candidate.seed) {
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

export const durationShown = (ms: number | null): string =>
  ms === null
    ? 'Unknown, as none of the set’s runs was timed'
    : `About ${lasted(ms)}`;

export const searchChanges = (candidate: SearchCandidate): ConfigChange[] =>
  configChangesOf(candidate.changes);

export const pickRefusal = (candidate: SearchCandidate): string | null => {
  if (candidate.seed) {
    return 'The live config is what the station runs already.';
  }

  switch (candidate.replayState) {
    case 'finished':
      return null;
    case 'stopped':
      return 'It can’t be picked: its replay was stopped before it finished.';
    case 'over-budget':
      return 'It can’t be picked: its replay ran over its ceiling before it finished.';
    case null:
      return 'It can’t be picked: its replay is gone.';
    default:
      return 'It can be picked once its replay on the searched tasks finishes.';
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

export type FrontierPoint = {
  readonly id: string;
  readonly name: string;
  readonly seed: boolean;
  readonly success: number;
  readonly cost: number;
  readonly frontier: boolean;
};

const charted = (candidate: SearchCandidate): boolean =>
  candidate.seed || candidate.replayState === 'finished';

export const frontierPoints = (
  detail: SearchDetail,
): {
  priced: FrontierPoint[];
  unpriced: SearchCandidate[];
  unfinished: SearchCandidate[];
} => {
  const scored = candidatesOf(detail).filter(
    (each) => each.searchScore !== null,
  );
  const finished = scored.filter(charted);

  return {
    priced: finished.flatMap((each) =>
      each.searchScore !== null && each.costPerRun !== null
        ? [
            {
              id: each.candidateId,
              name: candidateName(each),
              seed: each.seed,
              success: each.searchScore,
              cost: each.costPerRun,
              frontier: each.onFrontier,
            },
          ]
        : [],
    ),
    unpriced: finished.filter((each) => each.costPerRun === null),
    unfinished: scored.filter((each) => !charted(each)),
  };
};

export const candidateName = (candidate: SearchCandidate): string =>
  candidate.seed ? 'Live config' : candidate.name;

export const iterationsShown = (search: Search): string =>
  `${search.iterationsRun} of ${search.budget.iterations} ${search.budget.iterations === 1 ? 'iteration' : 'iterations'}`;

export const heldOutTitle = (
  entry: SplitEntry,
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

export const referenceShown = (
  reference: ReplayCheckSummary['reference'],
): string | null => {
  if (reference.pullRequest !== null) {
    return `Pull request #${reference.pullRequest}`;
  }

  return reference.commit ? `Commit ${reference.commit.slice(0, 7)}` : null;
};

export const regressionsShown = (count: number): string =>
  count === 1 ? '1 regression' : `${count} regressions`;

export const appPathOf = (url: string): string => {
  const parsed = new URL(url, 'http://spotlight.invalid');

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};
