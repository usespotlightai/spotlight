import type {
  FailureCauseResponseDto,
  LineReplayCheckResponseDto,
  ReflectedTaskResponseDto,
  ReplayCheckSummaryResponseDto,
  SearchBestResponseDto,
  SearchCandidateResponseDto,
  SearchDetailResponseDto,
  SearchIterationResponseDto,
  SearchResponseDto,
  SearchRunResponseDto,
} from '@/lib/api';
import { spentIn } from '@/lib/inbox';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import { minGainSentence } from '@/lib/replay-words';
import type {
  CauseKind,
  PullRequestStatus,
  SearchState,
} from '@/lib/search-words';
import { stationPath, stationTabPath } from '@/lib/station';
import { type ConfigChange, configChangesOf } from '@/lib/station-config';

export type Search = SearchResponseDto;
export type SearchDetail = SearchDetailResponseDto;
export type SearchCandidate = SearchCandidateResponseDto;
export type SearchRegressions = SearchCandidate['regressions'];
type SearchIteration = SearchIterationResponseDto;
export type SearchRun = SearchRunResponseDto;
export type ReplayCheckSummary = ReplayCheckSummaryResponseDto;
export type LineReplayCheck = LineReplayCheckResponseDto;

export const CHECKS_PAGE = 50;

export const SEARCHES_ANCHOR = 'searches';

export const SEARCHES_NOTE =
  'Spotlight starts a search on a schedule and when a station alert fires. A search agent proposes configs and replays each on the replay set of the station.';

export const SEED_NAME = 'seed';

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

export const pickedPullRequestOf = (
  detail: SearchDetail,
): PullRequestStatus | null =>
  detail.candidates.find(
    (each) => each.candidateId === detail.pick?.candidateId,
  )?.pullRequest ?? null;

export const candidatesOf = (detail: SearchDetail): SearchCandidate[] => [
  detail.seed,
  ...detail.candidates,
];

export const stillMoving = (detail: SearchDetail): boolean =>
  ongoing(detail.state) ||
  candidatesOf(detail).some(
    (each) =>
      each.pullRequest?.state === 'opening' ||
      each.pullRequest?.state === 'closing',
  );

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

export const formatTasks = (count: number): string =>
  count === 1 ? '1 task' : `${count} tasks`;

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

export const searchChanges = (candidate: SearchCandidate): ConfigChange[] =>
  configChangesOf(candidate.changes);

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
  { label: 'Best', size: 'minmax(8rem,2fr)' },
  { label: 'Success', numeric: true, size: SPREAD },
  { label: 'Iterations', numeric: true, size: SPREAD },
  { label: 'Spent', numeric: true, size: SPREAD },
  { label: 'Started', numeric: true, size: SPREAD },
];

const GATE_NOTE =
  'spotlight replay check replays the change of a pull request to this station on the station’s replay set. The check does not refresh the set.';

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
