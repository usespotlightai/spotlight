import type {
  CandidateResponseDto,
  EntryComparisonResponseDto,
  ReplayDetailResponseDto,
  ReplayEntryResponseDto,
  ReplayResponseDto,
  ReplayTotalsResponseDto,
  SpendResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { perWorld } from '@/mocks/world';
import { FINGERPRINTS } from '@/mocks/world/station-history';
import {
  gainOf,
  intervalOf,
  medianOf,
  rateOf,
  rounded,
  spread,
} from '@/mocks/world/station-measures';
import { runOfStation } from '@/mocks/world/station-sets';

export type Mark = 'S' | 'F' | 'running' | 'waiting' | 'not-run';

export type ReplaySpec = {
  readonly id: string;
  readonly setId: string;
  readonly candidate: CandidateResponseDto;
  readonly agent: { readonly model: string; readonly effort: string };
  startedAsBaseline: boolean;
  isBaseline: boolean;
  state: ReplayResponseDto['state'];
  readonly startedHoursAgo: number;
  endedHoursAgo: number | null;
  readonly runs: readonly string[];
  marks: Mark[];
  readonly comparedWith: string | null;
  readonly paired: boolean;
  readonly search: { searchId: string; candidateName: string } | null;
  readonly costFactor: number;
  readonly listed: boolean;
  readonly probe: boolean;
  readonly ceiling: SpendResponseDto;
};

export const BILLING_SET_ID = 'set_billing_work';
const BILLING_RUNS = [
  'run_flaky_billing_2',
  'run_invoice_split_1',
  'run_billing_worker_1',
  'run_pricing_cache_1',
  'run_refunds_1',
  'run_coupons_1',
  'run_vat_1',
] as const;

export const SEARCHED_RUNS = BILLING_RUNS.slice(0, 5);
export const HELD_OUT_RUNS = BILLING_RUNS.slice(5);

const candidate = (
  id: string,
  name: string,
  kind: CandidateResponseDto['kind'],
  fingerprint: string,
  createdHoursAgo: number,
): CandidateResponseDto => ({
  id,
  name,
  kind,
  fingerprint,
  station: { key: 'implementation' },
  createdAt: hoursAgo(createdHoursAgo),
});

export const CANDIDATES = {
  live3: candidate(
    'candidate_live_3',
    'live-3',
    'live',
    FINGERPRINTS.effort,
    312,
  ),
  live4: candidate(
    'candidate_live_4',
    'live-4',
    'live',
    FINGERPRINTS.tests,
    66,
  ),
  shorter: candidate(
    'candidate_shorter_prompt',
    'Shorter prompt',
    'proposed',
    FINGERPRINTS.shorter,
    5,
  ),
  testsFirst: candidate(
    'candidate_tests_first',
    'tests-first',
    'searched',
    FINGERPRINTS.tests,
    98.5,
  ),
  medium: candidate(
    'candidate_medium_effort',
    'medium-effort',
    'searched',
    FINGERPRINTS.medium,
    98.5,
  ),
  opus: candidate('candidate_opus', 'opus', 'searched', FINGERPRINTS.opus, 96),
  review: candidate(
    'candidate_review_skill',
    'review-skill',
    'searched',
    FINGERPRINTS.review,
    96,
  ),
  haiku: candidate(
    'candidate_haiku_small_fixes',
    'haiku-for-small-fixes',
    'searched',
    FINGERPRINTS.haiku,
    103.4,
  ),
} as const;

const CEILING: SpendResponseDto = { amount: 10, currency: 'USD' };

const LIVE_AGENT = { model: 'sonnet', effort: 'high' };

export type SpecInput = Partial<ReplaySpec> &
  Pick<
    ReplaySpec,
    'id' | 'candidate' | 'startedHoursAgo' | 'endedHoursAgo' | 'runs' | 'marks'
  >;

export const makeReplay = (over: SpecInput): ReplaySpec => ({
  setId: BILLING_SET_ID,
  agent: LIVE_AGENT,
  startedAsBaseline: false,
  isBaseline: false,
  state: 'finished',
  comparedWith: null,
  paired: false,
  search: null,
  costFactor: 1,
  listed: false,
  probe: false,
  ceiling: CEILING,
  ...over,
});

const searchOf = (searchId: string, candidateName: string) => ({
  searchId,
  candidateName,
});

const SEEDED: readonly ReplaySpec[] = [
  makeReplay({
    id: 'replay_shorter_prompt',
    candidate: CANDIDATES.shorter,
    agent: { model: 'sonnet', effort: 'medium' },
    state: 'running',
    startedHoursAgo: 1,
    endedHoursAgo: null,
    runs: BILLING_RUNS,
    marks: ['S', 'F', 'S', 'F', 'S', 'running', 'waiting'],
    comparedWith: 'replay_live_4',
    paired: true,
    costFactor: 0.75,
    listed: true,
  }),
  makeReplay({
    id: 'replay_live_4',
    candidate: CANDIDATES.live4,
    startedAsBaseline: true,
    isBaseline: true,
    startedHoursAgo: 50,
    endedHoursAgo: 48.8,
    runs: BILLING_RUNS,
    marks: ['S', 'S', 'S', 'F', 'S', 'F', 'S'],
    costFactor: 1.1,
    listed: true,
  }),
  makeReplay({
    id: 'replay_live_3',
    candidate: CANDIDATES.live3,
    startedAsBaseline: true,
    startedHoursAgo: 106,
    endedHoursAgo: 104.6,
    runs: BILLING_RUNS,
    marks: ['F', 'S', 'S', 'F', 'F', 'F', 'S'],
    listed: true,
  }),
  makeReplay({
    id: 'replay_sl_seed',
    candidate: CANDIDATES.live3,
    startedHoursAgo: 104,
    endedHoursAgo: 103.6,
    runs: SEARCHED_RUNS,
    marks: ['F', 'S', 'S', 'F', 'F'],
    search: searchOf('search_live', 'seed'),
  }),
  makeReplay({
    id: 'replay_sl_haiku',
    candidate: CANDIDATES.haiku,
    agent: { model: 'haiku', effort: 'high' },
    state: 'stopped',
    startedHoursAgo: 103.3,
    endedHoursAgo: 102.6,
    runs: SEARCHED_RUNS,
    marks: ['S', 'F', 'F', 'not-run', 'not-run'],
    comparedWith: 'replay_sl_seed',
    paired: true,
    costFactor: 0.3,
    search: searchOf('search_live', CANDIDATES.haiku.name),
  }),
  makeReplay({
    id: 'replay_tf_seed',
    candidate: CANDIDATES.live3,
    startedHoursAgo: 100,
    endedHoursAgo: 99.4,
    runs: SEARCHED_RUNS,
    marks: ['F', 'S', 'S', 'F', 'F'],
    search: searchOf('search_tests_first', 'seed'),
  }),
  makeReplay({
    id: 'replay_tf_seed_held_out',
    candidate: CANDIDATES.live3,
    startedHoursAgo: 93,
    endedHoursAgo: 92.7,
    runs: HELD_OUT_RUNS,
    marks: ['F', 'S'],
    search: searchOf('search_tests_first', 'seed'),
  }),
  makeReplay({
    id: 'replay_tf_tests_first',
    candidate: CANDIDATES.testsFirst,
    startedHoursAgo: 98.4,
    endedHoursAgo: 97.6,
    runs: SEARCHED_RUNS,
    marks: ['S', 'S', 'S', 'F', 'S'],
    comparedWith: 'replay_tf_seed',
    paired: true,
    costFactor: 1.15,
    search: searchOf('search_tests_first', CANDIDATES.testsFirst.name),
  }),
  makeReplay({
    id: 'replay_tf_tests_first_held_out',
    candidate: CANDIDATES.testsFirst,
    startedHoursAgo: 93,
    endedHoursAgo: 92.6,
    runs: HELD_OUT_RUNS,
    marks: ['F', 'S'],
    comparedWith: 'replay_tf_seed_held_out',
    paired: true,
    costFactor: 1.15,
    search: searchOf('search_tests_first', CANDIDATES.testsFirst.name),
  }),
  makeReplay({
    id: 'replay_tf_medium_effort',
    candidate: CANDIDATES.medium,
    agent: { model: 'sonnet', effort: 'medium' },
    startedHoursAgo: 98.4,
    endedHoursAgo: 97.8,
    runs: SEARCHED_RUNS,
    marks: ['F', 'S', 'S', 'F', 'S'],
    comparedWith: 'replay_tf_seed',
    paired: true,
    costFactor: 0.55,
    search: searchOf('search_tests_first', CANDIDATES.medium.name),
  }),
  makeReplay({
    id: 'replay_tf_medium_effort_held_out',
    candidate: CANDIDATES.medium,
    agent: { model: 'sonnet', effort: 'medium' },
    startedHoursAgo: 93,
    endedHoursAgo: 92.8,
    runs: HELD_OUT_RUNS,
    marks: ['F', 'S'],
    comparedWith: 'replay_tf_seed_held_out',
    paired: true,
    costFactor: 0.55,
    search: searchOf('search_tests_first', CANDIDATES.medium.name),
  }),
  makeReplay({
    id: 'replay_tf_opus',
    candidate: CANDIDATES.opus,
    agent: { model: 'opus', effort: 'high' },
    startedHoursAgo: 96,
    endedHoursAgo: 95,
    runs: SEARCHED_RUNS,
    marks: ['S', 'S', 'S', 'F', 'F'],
    comparedWith: 'replay_tf_seed',
    paired: true,
    costFactor: 1.6,
    search: searchOf('search_tests_first', CANDIDATES.opus.name),
  }),
  makeReplay({
    id: 'replay_tf_review_skill',
    candidate: CANDIDATES.review,
    startedHoursAgo: 96,
    endedHoursAgo: 95.1,
    runs: SEARCHED_RUNS,
    marks: ['S', 'F', 'S', 'F', 'S'],
    comparedWith: 'replay_tf_seed',
    paired: true,
    costFactor: 1.3,
    search: searchOf('search_tests_first', CANDIDATES.review.name),
  }),
];

export const replayStore = perWorld((kind): ReplaySpec[] =>
  kind === 'empty' ? [] : structuredClone([...SEEDED]),
);

export const replaySpec = (replayId: string): ReplaySpec | undefined =>
  replayStore().find((each) => each.id === replayId);

const replayRunId = (replay: ReplaySpec, place: number): string =>
  `${replay.id.replace(/^replay_/, 'run_replay_')}_${place + 1}`;

const SCORED = new Set<Mark>(['S', 'F']);

export const entryTiming = (replay: ReplaySpec, place: number) => {
  const startedHoursAgo =
    replay.startedHoursAgo - (place % 4) * 0.04 - Math.floor(place / 4) * 0.3;
  const ms = Math.round(
    spread(`${replay.id}:${place}`, 4, 14) * 60_000 * replay.costFactor ** 0.3,
  );

  return { startedHoursAgo, ms };
};

const judged = (score: number, passed: boolean) => ({
  state: 'judged' as const,
  scale: 'number' as const,
  score,
  passed,
  referenced: true,
  model: 'anthropic/claude-opus-5',
  unjudged: null,
  marks: null,
  passShare: null,
  claims: [],
  reasons: [],
});

const spentOf = (amount: number) => ({
  spends: [{ amount, currency: 'USD' }],
  unpriced: 0,
});

const WAITING: Omit<
  ReplayEntryResponseDto,
  'position' | 'originalRunId' | 'taskId' | 'runId' | 'fingerprint'
> = {
  repeat: 1,
  phase: 'waiting',
  ending: null,
  refusal: null,
  failure: null,
  next: null,
  ms: null,
  steps: null,
  cost: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  checks: null,
  judge: null,
  draftingSpent: null,
  judgingSpent: null,
  secondJudge: null,
  rejudgingSpent: null,
  recheck: null,
  pair: null,
  pairingSpent: null,
  result: 'pending',
  succeeded: null,
  reasons: [],
};

const entryOf = (replay: ReplaySpec, place: number): ReplayEntryResponseDto => {
  const originalRunId = replay.runs[place] ?? '';
  const original = runOfStation(originalRunId);
  const mark = replay.marks[place] ?? 'waiting';
  const head = {
    position: place,
    originalRunId,
    taskId: original?.taskId ?? '',
    runId: mark === 'waiting' ? null : replayRunId(replay, place),
    fingerprint: replay.candidate.fingerprint,
  };

  if (mark === 'waiting') {
    return { ...head, ...WAITING };
  }
  if (mark === 'running') {
    return { ...head, ...WAITING, phase: 'dispatched' };
  }
  if (mark === 'not-run') {
    return {
      ...head,
      ...WAITING,
      runId: null,
      phase: 'settled',
      ending: 'not-run',
      result: 'unscored',
      reasons: [
        {
          code: 'not-run',
          detail: 'The replay stopped first',
          steps: [],
          hunks: [],
        },
      ],
    };
  }

  const passed = mark === 'S';
  const { ms } = entryTiming(replay, place);
  const amount = rounded(
    spread(`${replay.id}:${place}:cost`, 0.45, 1.05) * replay.costFactor,
  );
  const note = original?.note;

  return {
    ...head,
    ...WAITING,
    phase: 'settled',
    ending: 'completed',
    next: 'review',
    ms,
    steps: Math.round(ms / 9_000),
    cost: { amount, currency: 'USD' },
    inputTokens: Math.round(amount * 4_200),
    outputTokens: Math.round(amount * 18_500),
    cacheReadTokens: Math.round(amount * 1_050_000),
    cacheWriteTokens: Math.round(amount * 52_000),
    checks: passed
      ? { state: 'passed', failedAt: [], why: null }
      : { state: 'failed', failedAt: ['npm test'], why: null },
    judge: passed ? judged(4, true) : judged(2, false),
    draftingSpent: spentOf(0.02),
    judgingSpent: spentOf(0.03),
    pairingSpent: replay.paired ? spentOf(0.04) : null,
    result: passed ? 'succeeded' : 'failed',
    succeeded: passed,
    reasons: passed
      ? [
          {
            code: 'judged',
            detail: note?.pass ?? '',
            steps: [],
            hunks: [],
          },
        ]
      : [
          { code: 'check-failed', detail: 'npm test', steps: [], hunks: [] },
          {
            code: 'judge-failed',
            detail: note?.fail ?? '',
            steps: [3],
            hunks: [],
          },
        ],
  };
};

export const entriesOf = (replay: ReplaySpec): ReplayEntryResponseDto[] =>
  replay.runs.map((_, place) => entryOf(replay, place));

const totalsOf = (
  entries: readonly ReplayEntryResponseDto[],
): ReplayTotalsResponseDto => {
  const settled = entries.filter((each) => each.phase === 'settled');
  const scored = settled.filter((each) => each.succeeded !== null);
  const succeeded = scored.filter((each) => each.succeeded).length;
  const spent = settled.reduce(
    (total, each) => total + (each.cost?.amount ?? 0),
    0,
  );
  const steps = settled.flatMap((each) =>
    each.steps === null ? [] : [each.steps],
  );
  const took = settled.flatMap((each) => (each.ms === null ? [] : [each.ms]));

  return {
    entries: entries.length,
    settled: settled.length,
    completed: settled.filter((each) => each.ending === 'completed').length,
    failed: settled.filter((each) => each.ending === 'failed').length,
    stopped: settled.filter((each) => each.ending === 'stopped').length,
    asked: 0,
    unreplayable: 0,
    notRun: settled.filter((each) => each.ending === 'not-run').length,
    succeeded: scored.length === 0 ? null : succeeded,
    successRate: rateOf(succeeded, scored.length),
    interval: intervalOf(succeeded, scored.length),
    scored: scored.length,
    tasks: entries.length,
    tasksScored: scored.length,
    unscored: settled.length - scored.length,
    spent: { amount: rounded(spent), currency: 'USD' },
    spentElsewhere: [],
    unpriced: 0,
    unpricedCalls: 0,
    steps: steps.reduce((total, each) => total + each, 0),
    medianSteps: medianOf(steps),
    ms: took.reduce((total, each) => total + each, 0),
    medianMs: medianOf(took),
  };
};

type Paired = {
  readonly candidate: ReplayEntryResponseDto;
  readonly baseline: ReplayEntryResponseDto | undefined;
};

const pairsWith = (replay: ReplaySpec): Paired[] => {
  const against = replay.comparedWith ? replaySpec(replay.comparedWith) : null;
  const baselineEntries = against ? entriesOf(against) : [];

  return entriesOf(replay).map((entry) => ({
    candidate: entry,
    baseline: baselineEntries.find(
      (each) => each.originalRunId === entry.originalRunId,
    ),
  }));
};

const bothScored = (pairs: readonly Paired[]) =>
  pairs.flatMap(({ candidate, baseline }) =>
    candidate.succeeded !== null &&
    baseline?.succeeded !== null &&
    baseline !== undefined
      ? [{ candidate: candidate.succeeded, baseline: baseline.succeeded }]
      : [],
  );

export const againstOf = (replay: ReplaySpec) => {
  if (!replay.comparedWith) {
    return { gain: null, pairs: null };
  }

  const scored = bothScored(pairsWith(replay));
  const gain = gainOf(
    scored.map((each) => each.candidate),
    scored.map((each) => each.baseline),
  );
  const pairs = replay.paired
    ? {
        wins: scored.filter((each) => each.candidate && !each.baseline).length,
        losses: scored.filter((each) => !each.candidate && each.baseline)
          .length,
        ties: scored.filter((each) => each.candidate === each.baseline).length,
      }
    : null;

  return { gain, pairs };
};

export const replayOf = (replay: ReplaySpec): ReplayResponseDto => {
  const entries = entriesOf(replay);
  const { gain, pairs } = againstOf(replay);

  return {
    id: replay.id,
    setId: replay.setId,
    candidate: replay.candidate,
    startedAsBaseline: replay.startedAsBaseline,
    isBaseline: replay.isBaseline,
    judges: true,
    checks: true,
    state: replay.state,
    ceiling: replay.ceiling,
    repeats: 1,
    probe: replay.probe,
    startedAt: hoursAgo(replay.startedHoursAgo),
    endedAt:
      replay.endedHoursAgo === null ? null : hoursAgo(replay.endedHoursAgo),
    totals: totalsOf(entries),
    againstBaseline: gain,
    pairedWith: replay.paired ? replay.comparedWith : null,
    pairsAgainstBaseline: pairs,
    entries,
  };
};

const pairOf = (
  candidate: ReplayEntryResponseDto,
  baseline: ReplayEntryResponseDto | undefined,
): EntryComparisonResponseDto['pair'] => {
  if (
    candidate.succeeded === null ||
    !baseline ||
    baseline.succeeded === null
  ) {
    return null;
  }
  if (candidate.succeeded === baseline.succeeded) {
    return 'tie';
  }

  return candidate.succeeded ? 'win' : 'loss';
};

const comparisonOf = (
  replay: ReplaySpec,
  { candidate, baseline }: Paired,
): EntryComparisonResponseDto => {
  const score = (entry: ReplayEntryResponseDto | undefined) =>
    entry?.judge?.score ?? null;
  const candidateScore = score(candidate);
  const baselineScore = score(baseline);

  return {
    originalRunId: candidate.originalRunId,
    taskId: candidate.taskId,
    title: runOfStation(candidate.originalRunId)?.title ?? null,
    candidate: [candidate],
    baseline: baseline ? [baseline] : [],
    candidateSuccess:
      candidate.succeeded === null ? null : Number(candidate.succeeded),
    baselineSuccess:
      !baseline || baseline.succeeded === null
        ? null
        : Number(baseline.succeeded),
    costDelta:
      candidate.cost && baseline?.cost
        ? rounded(candidate.cost.amount - baseline.cost.amount)
        : null,
    msDelta:
      candidate.ms !== null && baseline?.ms != null
        ? candidate.ms - baseline.ms
        : null,
    stepsDelta:
      candidate.steps !== null && baseline?.steps != null
        ? candidate.steps - baseline.steps
        : null,
    scoreDelta:
      candidateScore !== null && baselineScore !== null
        ? candidateScore - baselineScore
        : null,
    scoreUncompared:
      baseline && (candidateScore === null || baselineScore === null)
        ? 'unjudged'
        : null,
    regressed: baseline?.succeeded === true && candidate.succeeded === false,
    pair: replay.paired ? pairOf(candidate, baseline) : null,
  };
};

export const baselineOfSet = (setId: string): ReplaySpec | undefined =>
  replayStore().find((each) => each.setId === setId && each.isBaseline);

export const replayDetailOf = (
  replay: ReplaySpec,
): ReplayDetailResponseDto => ({
  ...replayOf(replay),
  baselineReplayId: baselineOfSet(replay.setId)?.id ?? null,
  comparedWithReplayId: replay.comparedWith,
  search: replay.search,
  comparison: pairsWith(replay).map((pair) => comparisonOf(replay, pair)),
});

export const listedReplays = (setId: string): ReplayResponseDto[] =>
  replayStore()
    .filter((each) => each.setId === setId && each.listed)
    .sort((one, other) => one.startedHoursAgo - other.startedHoursAgo)
    .map(replayOf);

export const scoredMarks = (replay: ReplaySpec): boolean[] =>
  replay.marks.flatMap((mark) => (SCORED.has(mark) ? [mark === 'S'] : []));
