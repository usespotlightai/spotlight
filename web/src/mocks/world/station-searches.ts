import type {
  CandidatePullRequestResponseDto,
  CandidateResponseDto,
  SearchBudgetResponseDto,
  SearchCandidateResponseDto,
  SearchDetailResponseDto,
  SearchIterationResponseDto,
  SearchResponseDto,
  StationChangeResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { perWorld, world } from '@/mocks/world';
import {
  added,
  changed,
  TESTS_FIRST_PULL_REQUEST,
} from '@/mocks/world/station-history';
import { intervalOf, rateOf, rounded } from '@/mocks/world/station-measures';
import {
  BILLING_SET_ID,
  CANDIDATES,
  gainOverReferenceOf,
  HELD_OUT_RUNS,
  type ReplaySpec,
  replayOf,
  replaySpec,
  runsOfSet,
  SEARCHED_RUNS,
  scoredMarks,
} from '@/mocks/world/station-replays';
import { SEARCH_SEEDS, type SearchSeed } from '@/mocks/world/station-seeds';
import { runOfStation, setSpec, teamOfLine } from '@/mocks/world/station-sets';

export type SearchCandidateSpec = {
  readonly candidate: CandidateResponseDto;
  readonly isSeed: boolean;
  readonly iteration: number | null;
  readonly hypothesis: string | null;
  readonly changes: readonly StationChangeResponseDto[];
  readonly replayId: string;
  readonly heldOutReplayId: string | null;
  readonly onFrontier: boolean;
  readonly overfit: SearchCandidateResponseDto['overfit'];
  pullRequest: CandidatePullRequestResponseDto | null;
};

export type SearchSpec = {
  readonly id: string;
  readonly setId: string;
  state: SearchResponseDto['state'];
  stopReason: SearchResponseDto['stopReason'];
  readonly agent: SearchResponseDto['agent'];
  readonly budget: SearchBudgetResponseDto;
  readonly objective: SearchResponseDto['objective'];
  readonly startedHoursAgo: number;
  endedHoursAgo: number | null;
  readonly iterations: readonly SearchIterationResponseDto[];
  readonly seed: SearchCandidateSpec;
  readonly candidates: readonly SearchCandidateSpec[];
  readonly bestId: string | null;
  readonly frontier: readonly string[];
  readonly searched: readonly string[];
  readonly heldOut: readonly string[];
};

const AGENT = { harness: 'claude-code', model: 'opus', effort: 'high' };

const seedOf = (replayId: string, heldOutReplayId: string | null) => ({
  candidate: CANDIDATES.live3,
  isSeed: true,
  iteration: null,
  hypothesis: null,
  changes: [],
  replayId,
  heldOutReplayId,
  onFrontier: true,
  overfit: null,
  pullRequest: null,
});

const agentSpent = (amount: number) => ({
  spends: [{ amount, currency: 'USD' }],
  unpriced: 0,
});

const SEEDED: readonly SearchSpec[] = [
  {
    id: 'search_tests_first',
    setId: BILLING_SET_ID,
    state: 'finished',
    stopReason: 'iterations-spent',
    agent: AGENT,
    budget: {
      iterations: 3,
      perIteration: 2,
      ceiling: { amount: 40, currency: 'USD' },
      concurrency: 4,
      repeats: 1,
    },
    objective: 'success',
    startedHoursAgo: 100,
    endedHoursAgo: 92.5,
    iterations: [
      {
        number: 1,
        kind: 'propose',
        runId: 'run_search_tests_first_1',
        state: 'ended',
        attempts: 3,
        proposed: ['candidate_tests_first', 'candidate_medium_effort'],
        agentSpent: agentSpent(0.62),
        reflection: null,
      },
      {
        number: 2,
        kind: 'propose',
        runId: 'run_search_tests_first_2',
        state: 'ended',
        attempts: 2,
        proposed: ['candidate_opus', 'candidate_review_skill'],
        agentSpent: agentSpent(0.58),
        reflection: null,
      },
      {
        number: 3,
        kind: 'propose',
        runId: 'run_search_tests_first_3',
        state: 'failed',
        attempts: 0,
        proposed: [],
        agentSpent: null,
        reflection: null,
      },
    ],
    seed: seedOf('replay_tf_seed', 'replay_tf_seed_held_out'),
    candidates: [
      {
        candidate: CANDIDATES.testsFirst,
        isSeed: false,
        iteration: 1,
        hypothesis:
          'Runs fail when they change billing code before reading its tests. Telling it to read and run the tests first should lift success on the flaky-test and refund tasks.',
        changes: [changed('prompt')],
        replayId: 'replay_tf_tests_first',
        heldOutReplayId: 'replay_tf_tests_first_held_out',
        onFrontier: true,
        overfit: 'likely',
        pullRequest: {
          id: 'config_pull_request_58',
          state: 'opened',
          url: TESTS_FIRST_PULL_REQUEST,
          reason: null,
        },
      },
      {
        candidate: CANDIDATES.medium,
        isSeed: false,
        iteration: 1,
        hypothesis:
          'Most of these tasks are small. Medium effort should succeed as often for much less.',
        changes: [changed('effort', 'high', 'medium')],
        replayId: 'replay_tf_medium_effort',
        heldOutReplayId: 'replay_tf_medium_effort_held_out',
        onFrontier: true,
        overfit: null,
        pullRequest: null,
      },
      {
        candidate: CANDIDATES.opus,
        isSeed: false,
        iteration: 2,
        hypothesis:
          'The refund and cache tasks need more context than Sonnet keeps. Opus may get them right the first time.',
        changes: [changed('model', 'sonnet', 'opus')],
        replayId: 'replay_tf_opus',
        heldOutReplayId: null,
        onFrontier: false,
        overfit: null,
        pullRequest: null,
      },
      {
        candidate: CANDIDATES.review,
        isSeed: false,
        iteration: 2,
        hypothesis: 'Its own review pass should catch the missed edge cases.',
        changes: [added('skill', 'self-review')],
        replayId: 'replay_tf_review_skill',
        heldOutReplayId: null,
        onFrontier: false,
        overfit: null,
        pullRequest: null,
      },
    ],
    bestId: 'candidate_tests_first',
    frontier: [
      'candidate_live_3',
      'candidate_medium_effort',
      'candidate_tests_first',
    ],
    searched: SEARCHED_RUNS,
    heldOut: HELD_OUT_RUNS,
  },
  {
    id: 'search_live',
    setId: BILLING_SET_ID,
    state: 'stopped',
    stopReason: 'stopped',
    agent: AGENT,
    budget: {
      iterations: 4,
      perIteration: 1,
      ceiling: { amount: 15, currency: 'USD' },
      concurrency: 2,
      repeats: 1,
    },
    objective: 'cost',
    startedHoursAgo: 104,
    endedHoursAgo: 102.6,
    iterations: [
      {
        number: 1,
        kind: 'propose',
        runId: 'run_search_live_1',
        state: 'ended',
        attempts: 1,
        proposed: ['candidate_haiku_small_fixes'],
        agentSpent: agentSpent(0.31),
        reflection: null,
      },
    ],
    seed: seedOf('replay_sl_seed', null),
    candidates: [
      {
        candidate: CANDIDATES.haiku,
        isSeed: false,
        iteration: 1,
        hypothesis:
          'Most billing fixes touch a few lines. Haiku should land them for a fraction of the cost.',
        changes: [changed('model', 'sonnet', 'haiku')],
        replayId: 'replay_sl_haiku',
        heldOutReplayId: null,
        onFrontier: false,
        overfit: null,
        pullRequest: null,
      },
    ],
    bestId: 'candidate_live_3',
    frontier: ['candidate_live_3'],
    searched: SEARCHED_RUNS,
    heldOut: HELD_OUT_RUNS,
  },
];

const searchOfSeed = (seed: SearchSeed): SearchSpec => ({
  ...structuredClone(seed),
  searched: runsOfSet(seed.setId, 'searched'),
  heldOut: runsOfSet(seed.setId, 'held-out'),
});

export const searchStore = perWorld((kind): SearchSpec[] =>
  kind === 'empty'
    ? []
    : [...structuredClone([...SEEDED]), ...SEARCH_SEEDS.map(searchOfSeed)],
);

export const searchSpec = (searchId: string): SearchSpec | undefined =>
  searchStore().find((each) => each.id === searchId);

const rateIn = (replay: ReplaySpec | undefined) => {
  if (!replay) {
    return { score: null, interval: null, scored: 0 };
  }

  const marks = scoredMarks(replay);
  const succeeded = marks.filter(Boolean).length;

  return {
    score: rateOf(succeeded, marks.length),
    interval: intervalOf(succeeded, marks.length),
    scored: marks.length,
  };
};

const spentIn = (replay: ReplaySpec | undefined): number =>
  replay ? replayOf(replay).totals.spent.amount : 0;

export const maxRegressionsOf = (search: SearchSpec): number | null => {
  const lineId = setSpec(search.setId)?.lineId ?? '';
  const line = world().lines[teamOfLine(lineId) ?? '']?.find(
    (each) => each.id === lineId,
  );

  return line?.replayCheck?.maxRegressions ?? null;
};

export const searchCandidateOf = (
  spec: SearchCandidateSpec,
  maxRegressions: number | null,
): SearchCandidateResponseDto => {
  const replay = replaySpec(spec.replayId);
  const heldOut = spec.heldOutReplayId
    ? replaySpec(spec.heldOutReplayId)
    : undefined;
  const searched = rateIn(replay);
  const heldOutRate = rateIn(heldOut);
  const against = replay ? gainOverReferenceOf(replay) : null;
  const heldOutGain = heldOut ? gainOverReferenceOf(heldOut) : null;
  const totals = replay ? replayOf(replay).totals : null;
  const searchedRegressions = spec.isSeed
    ? null
    : (against?.regressions ?? null);
  const heldOutRegressions = spec.isSeed
    ? null
    : (heldOutGain?.regressions ?? null);
  const regressions = {
    searched: searchedRegressions,
    heldOut: heldOutRegressions,
    total:
      searchedRegressions === null && heldOutRegressions === null
        ? null
        : (searchedRegressions ?? 0) + (heldOutRegressions ?? 0),
  };

  return {
    candidateId: spec.candidate.id,
    name: spec.isSeed ? 'seed' : spec.candidate.name,
    isSeed: spec.isSeed,
    iteration: spec.iteration,
    hypothesis: spec.hypothesis,
    fingerprint: spec.candidate.fingerprint,
    changes: [...spec.changes],
    replayId: spec.replayId,
    replayState: replay?.state ?? null,
    heldOutReplayId: spec.heldOutReplayId,
    heldOutReplayState: heldOut?.state ?? null,
    searchScore: searched.score,
    searchInterval: searched.interval,
    searchScored: searched.scored,
    heldOutScore: heldOutRate.score,
    heldOutInterval: heldOutRate.interval,
    searchedGain: against?.gain ?? null,
    heldOutGain: heldOutGain?.gain ?? null,
    searchedPairs: against?.pairs ?? null,
    heldOutPairs: heldOutGain?.pairs ?? null,
    costPerRun:
      totals && totals.ended > 0
        ? rounded(totals.spent.amount / totals.ended)
        : null,
    spent: {
      amount: rounded(spentIn(replay) + spentIn(heldOut)),
      currency: 'USD',
    },
    onFrontier: spec.onFrontier,
    overfit: spec.overfit,
    regressions,
    exceedsRegressionLimit:
      maxRegressions !== null &&
      regressions.total !== null &&
      regressions.total > maxRegressions,
    pullRequest: spec.pullRequest,
  };
};

const candidatesOf = (search: SearchSpec) =>
  [search.seed, ...search.candidates].map((each) =>
    searchCandidateOf(each, maxRegressionsOf(search)),
  );

export const searchSummaryOf = (search: SearchSpec): SearchResponseDto => {
  const all = candidatesOf(search);
  const best = all.find((each) => each.candidateId === search.bestId);
  const agentCost = search.iterations.reduce(
    (total, each) => total + (each.agentSpent?.spends[0]?.amount ?? 0),
    0,
  );

  const set = setSpec(search.setId);

  return {
    id: search.id,
    lineId: set?.lineId ?? '',
    stationId: set?.stationId ?? '',
    setId: search.setId,
    state: search.state,
    stopReason: search.stopReason,
    agent: search.agent,
    budget: search.budget,
    objective: search.objective,
    spent: {
      amount: rounded(
        all.reduce((total, each) => total + each.spent.amount, agentCost),
      ),
      currency: 'USD',
    },
    iterationsRun: search.iterations.filter((each) => each.state !== 'wanted')
      .length,
    proposed: search.candidates.length,
    best: best
      ? {
          candidateId: best.candidateId,
          name: best.name,
          isSeed: best.isSeed,
          searchScore: best.searchScore,
          searchInterval: best.searchInterval,
          heldOutScore: best.heldOutScore,
          heldOutInterval: best.heldOutInterval,
          costPerRun: best.costPerRun,
          overfit: best.overfit,
          regressions: best.regressions,
          exceedsRegressionLimit: best.exceedsRegressionLimit,
        }
      : null,
    maxRegressions: maxRegressionsOf(search),
    startedAt: hoursAgo(search.startedHoursAgo),
    endedAt:
      search.endedHoursAgo === null ? null : hoursAgo(search.endedHoursAgo),
  };
};

const splitEntries = (runIds: readonly string[]) =>
  runIds.map((runId) => ({
    runId,
    taskId: runOfStation(runId)?.taskId ?? '',
  }));

export const searchDetailOf = (search: SearchSpec): SearchDetailResponseDto => {
  const [seed, ...candidates] = candidatesOf(search);

  return {
    ...searchSummaryOf(search),
    split: {
      searchedTasks: search.searched.length,
      heldOutTasks: search.heldOut.length,
      searched: splitEntries(search.searched),
      heldOut: splitEntries(search.heldOut),
    },
    iterations: [...search.iterations],
    seed: seed as SearchCandidateResponseDto,
    candidates,
    frontier: [...search.frontier],
    overfitCount: candidates.filter((each) => each.overfit === 'likely').length,
    minGain: 0.05,
  };
};
