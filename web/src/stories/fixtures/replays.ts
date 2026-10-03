import type { QueryClient } from '@tanstack/react-query';
import { lineKeys } from '@/hooks/api/useLines';
import { replayableRunKeys } from '@/hooks/api/useReplayableRuns';
import { replayCandidateKeys } from '@/hooks/api/useReplayCandidates';
import { replayRunKeys } from '@/hooks/api/useReplayRun';
import { replayCheckKeys } from '@/hooks/api/useReplaySetChecks';
import { replaySetSuggestionKeys } from '@/hooks/api/useReplaySetSuggestions';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { replayKeys } from '@/hooks/api/useReplays';
import { runConfigKeys } from '@/hooks/api/useRunConfig';
import { teamResourceKeys } from '@/hooks/api/useTeamResource';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  CandidateResponseDto,
  EntryComparisonResponseDto,
  LineResponseDto,
  ReplayableRunResponseDto,
  ReplayCandidateResourceResponseDto,
  ReplayCheckSummaryResponseDto,
  ReplayDetailResponseDto,
  ReplayEntryResponseDto,
  ReplayOfRunResponseDto,
  ReplayResponseDto,
  ReplayRunResponseDto,
  ReplaySetResponseDto,
  ReplayTotalsResponseDto,
  SetCompositionResponseDto,
  SuggestedRunResponseDto,
  TeamResourceResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import {
  LINE_ID,
  STATION_ID,
  seedStation,
  seedStationPlace,
} from '@/stories/fixtures/station';
import { NOT_ON_TEAM, SLUG, TEAM_ID, WORKSPACE } from '@/stories/fixtures/team';

export { LINE_ID, SLUG, STATION_ID, TEAM_ID };

export const SET_ID = 'set_queue_fixes';
export const EMPTY_SET_ID = 'set_flaky_checks';
export const REPLAY_ID = 'replay_shorter_prompt';
export const BASELINE_ID = 'replay_baseline';
export const REPLAY_RUN_ID = 'run_replay_drain';

const ADDRESS = 'platform/default/implementation';
const LIVE_FINGERPRINT =
  'b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c93f2a9c1e';
const CANDIDATE_FINGERPRINT =
  '5e1c7a93d2f4b6a8c0e2d4f6a8b0c2e4f6a8b0d2c4e6f8a0b2d4c6e8f0a2b4c6';

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();

const TEAM: TeamResourceResponseDto = {
  id: TEAM_ID,
  version: 3,
  address: 'platform',
  warnings: [],
  workspaceId: WORKSPACE.id,
  key: 'platform',
  name: 'Platform',
};

const PROPOSED: ReplayCandidateResourceResponseDto = {
  id: 'candidate_shorter_prompt',
  version: 0,
  address: `${ADDRESS}/shorter-prompt`,
  warnings: [],
  teamId: TEAM_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
  stationAddress: ADDRESS,
  name: 'Shorter prompt',
  kind: 'proposed',
  station: { key: 'implementation' },
  fingerprint: CANDIDATE_FINGERPRINT,
  changedFrom: {
    fingerprint: LIVE_FINGERPRINT,
    changes: [
      { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
      {
        part: 'effort',
        name: null,
        kind: 'changed',
        was: 'high',
        now: 'medium',
      },
    ],
  },
  createdAt: hoursAgo(5),
};

const LIVE_SNAPSHOT: ReplayCandidateResourceResponseDto = {
  ...PROPOSED,
  id: 'candidate_live_1',
  address: `${ADDRESS}/live-1`,
  name: 'live-1',
  kind: 'live',
  fingerprint: LIVE_FINGERPRINT,
  changedFrom: { fingerprint: LIVE_FINGERPRINT, changes: [] },
  createdAt: hoursAgo(26),
};

const CANDIDATES = [PROPOSED];

const replayed = (
  candidate: ReplayCandidateResourceResponseDto,
): CandidateResponseDto => ({
  id: candidate.id,
  name: candidate.name,
  kind: candidate.kind,
  fingerprint: candidate.fingerprint,
  station: candidate.station,
  createdAt: candidate.createdAt,
});

const ORIGINALS = [
  {
    runId: 'run_retries_3',
    taskId: 'task_retries',
    title: 'Drain the stuck retry queues',
  },
  {
    runId: 'run_docs_1',
    taskId: 'task_docs',
    title: 'Document the webhook retry policy',
  },
  {
    runId: 'run_flaky_2',
    taskId: 'task_flaky',
    title: 'Fix the flaky billing test',
  },
] as const;

const composedOf = (
  counts: Readonly<Record<string, number>>,
  origins: SetCompositionResponseDto['origins'],
  ended: { oldest: string; median: string; newest: string } | null,
): SetCompositionResponseDto => ({
  outcomes: (
    ['accepted', 'sent-back', 'asked', 'failed', 'other'] as const
  ).map((outcome) => ({ outcome, count: counts[outcome] ?? 0 })),
  origins,
  oldest: ended?.oldest ?? null,
  median: ended?.median ?? null,
  newest: ended?.newest ?? null,
  balanceWarning: null,
});

const SET: ReplaySetResponseDto = {
  id: SET_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
  name: 'Queue fixes',
  createdAt: hoursAgo(30),
  stationGone: false,
  guardsChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
  },
  minGain: 0.05,
  composition: composedOf(
    { accepted: 1, 'sent-back': 1, failed: 1 },
    [
      { origin: 'person', count: 2 },
      { origin: 'slack', count: 1 },
    ],
    { oldest: hoursAgo(74), median: hoursAgo(50), newest: hoursAgo(28) },
  ),
  entries: [
    {
      ...ORIGINALS[0],
      state: 'completed',
      endedAt: hoursAgo(28),
      addedAt: hoursAgo(29),
      refusal: null,
      reason: null,
      outcome: 'accepted',
      origin: 'person',
    },
    {
      ...ORIGINALS[1],
      state: 'completed',
      endedAt: hoursAgo(50),
      addedAt: hoursAgo(29),
      refusal: null,
      reason: null,
      outcome: 'sent-back',
      origin: 'slack',
    },
    {
      ...ORIGINALS[2],
      state: 'failed',
      endedAt: hoursAgo(74),
      addedAt: hoursAgo(29),
      refusal: 'task-gone',
      reason: 'the task it worked was deleted',
      outcome: 'failed',
      origin: 'person',
    },
  ],
};

const LOPSIDED_SET: ReplaySetResponseDto = {
  ...SET,
  composition: {
    ...composedOf(
      { accepted: 1, failed: 7 },
      [
        { origin: 'person', count: 5 },
        { origin: 'github', count: 3 },
      ],
      { oldest: hoursAgo(400), median: hoursAgo(120), newest: hoursAgo(28) },
    ),
    balanceWarning: { dominant: 'failed', count: 7, entries: 8 },
  },
};

const EMPTY_SET: ReplaySetResponseDto = {
  id: EMPTY_SET_ID,
  lineId: LINE_ID,
  stationId: STATION_ID,
  name: 'Flaky checks',
  createdAt: hoursAgo(3),
  stationGone: false,
  guardsChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
  },
  minGain: 0.05,
  composition: composedOf({}, [], null),
  entries: [],
};

const totals = (
  over: Partial<ReplayTotalsResponseDto>,
): ReplayTotalsResponseDto => ({
  entries: 3,
  settled: 3,
  completed: 3,
  failed: 0,
  stopped: 0,
  asked: 0,
  unreplayable: 0,
  notRun: 0,
  succeeded: 1,
  successRate: 0.5,
  interval: { rate: 0.5, low: 0, high: 1 },
  scored: 2,
  tasks: 3,
  tasksScored: 2,
  unscored: 1,
  spent: { amount: 2.41, currency: 'USD' },
  spentElsewhere: [],
  unpriced: 0,
  unpricedCalls: 0,
  steps: 140,
  medianSteps: 46,
  ms: 1_380_000,
  medianMs: 450_000,
  ...over,
});

const entry = (
  over: Partial<ReplayEntryResponseDto> & {
    position: number;
    originalRunId: string;
  },
): ReplayEntryResponseDto => ({
  taskId: `task_${over.position}`,
  repeat: 1,
  runId: `${over.originalRunId}_replayed`,
  fingerprint: CANDIDATE_FINGERPRINT,
  phase: 'settled',
  ending: 'completed',
  refusal: null,
  failure: null,
  next: 'review',
  ms: 420_000,
  steps: 44,
  cost: { amount: 0.72, currency: 'USD' },
  inputTokens: 3_100,
  outputTokens: 14_200,
  cacheReadTokens: 812_000,
  cacheWriteTokens: 41_000,
  checks: { state: 'passed', failedAt: [], why: null },
  judge: {
    state: 'judged',
    scale: 'number',
    score: 4,
    passed: true,
    referenced: true,
    model: 'anthropic/claude-opus-5',
    unjudged: null,
    marks: null,
    passShare: null,
    claims: [],
    reasons: [],
  },
  draftingSpent: { spends: [{ amount: 0.02, currency: 'USD' }], unpriced: 0 },
  judgingSpent: { spends: [{ amount: 0.03, currency: 'USD' }], unpriced: 0 },
  secondJudge: null,
  rejudgingSpent: null,
  recheck: null,
  pair: null,
  pairingSpent: null,
  result: 'succeeded',
  succeeded: true,
  reasons: [
    {
      code: 'judged',
      detail: 'Drained the queue and kept the tests passing.',
      steps: [],
      hunks: [],
    },
  ],
  ...over,
});

const CANDIDATE_ENTRIES: ReplayEntryResponseDto[] = [
  entry({
    position: 0,
    originalRunId: ORIGINALS[0].runId,
    runId: REPLAY_RUN_ID,
    result: 'failed',
    succeeded: false,
    checks: { state: 'failed', failedAt: ['npm test'], why: null },
    judge: {
      state: 'judged',
      scale: 'number',
      score: 2,
      passed: false,
      referenced: true,
      model: 'anthropic/claude-opus-5',
      unjudged: null,
      marks: null,
      passShare: null,
      claims: [],
      reasons: [],
    },
    reasons: [
      { code: 'check-failed', detail: 'npm test', steps: [], hunks: [] },
      {
        code: 'judge-failed',
        detail: 'It left two retries unhandled.',
        steps: [12],
        hunks: [],
      },
    ],
  }),
  entry({
    position: 1,
    originalRunId: ORIGINALS[1].runId,
    ms: 300_000,
    cost: { amount: 0.41, currency: 'USD' },
  }),
  entry({
    position: 2,
    originalRunId: ORIGINALS[2].runId,
    runId: null,
    phase: 'settled',
    ending: 'unreplayable',
    refusal: 'task-gone',
    ms: null,
    steps: null,
    cost: null,
    checks: null,
    judge: null,
    draftingSpent: null,
    judgingSpent: null,
    secondJudge: null,
    rejudgingSpent: null,
    recheck: null,
    pair: null,
    pairingSpent: null,
    result: 'unscored',
    succeeded: null,
    reasons: [
      { code: 'unreplayable', detail: 'task-gone', steps: [], hunks: [] },
    ],
  }),
];

const BASELINE_ENTRIES: ReplayEntryResponseDto[] = CANDIDATE_ENTRIES.map(
  (each, at) =>
    at === 0
      ? entry({
          position: 0,
          originalRunId: each.originalRunId,
          runId: 'run_baseline_drain',
          fingerprint: LIVE_FINGERPRINT,
        })
      : at === 1
        ? entry({
            position: 1,
            originalRunId: each.originalRunId,
            runId: 'run_baseline_docs',
            fingerprint: LIVE_FINGERPRINT,
            result: 'failed',
            succeeded: false,
            ms: 540_000,
            cost: { amount: 0.88, currency: 'USD' },
            judge: {
              state: 'judged',
              scale: 'number',
              score: 3,
              passed: false,
              referenced: true,
              model: 'anthropic/claude-opus-5',
              unjudged: null,
              marks: null,
              passShare: null,
              claims: [],
              reasons: [],
            },
            reasons: [
              {
                code: 'judge-failed',
                detail: 'It documented the old policy.',
                steps: [],
                hunks: [],
              },
            ],
          })
        : { ...each, fingerprint: LIVE_FINGERPRINT },
);

const BASELINE: ReplayResponseDto = {
  id: BASELINE_ID,
  setId: SET_ID,
  candidate: replayed(LIVE_SNAPSHOT),
  startedAsBaseline: true,
  isBaseline: true,
  judges: true,
  checks: true,
  state: 'finished',
  ceiling: { amount: 5, currency: 'USD' },
  repeats: 1,
  probe: false,
  startedAt: hoursAgo(26),
  endedAt: hoursAgo(25),
  totals: totals({ successRate: 0.5, succeeded: 1 }),
  againstBaseline: null,
  pairedWith: null,
  pairsAgainstBaseline: null,
  entries: BASELINE_ENTRIES,
};

const CANDIDATE_REPLAY: ReplayResponseDto = {
  id: REPLAY_ID,
  setId: SET_ID,
  candidate: replayed(PROPOSED),
  startedAsBaseline: false,
  isBaseline: false,
  judges: true,
  checks: true,
  state: 'running',
  ceiling: { amount: 5, currency: 'USD' },
  repeats: 1,
  probe: false,
  startedAt: hoursAgo(1),
  endedAt: null,
  totals: totals({
    successRate: 0.5,
    succeeded: 1,
    spent: { amount: 1.23, currency: 'USD' },
  }),
  againstBaseline: {
    gain: 0,
    low: -0.5,
    high: 0.5,
    verdict: 'within-noise',
    minGain: 0.05,
    tasks: 3,
  },
  pairedWith: BASELINE_ID,
  pairsAgainstBaseline: { wins: 1, losses: 1, ties: 0 },
  entries: CANDIDATE_ENTRIES,
};

const compared = (
  candidate: ReplayEntryResponseDto,
  baseline: ReplayEntryResponseDto,
  over: Partial<EntryComparisonResponseDto>,
): EntryComparisonResponseDto => ({
  originalRunId: candidate.originalRunId,
  taskId: candidate.taskId,
  title:
    ORIGINALS.find((each) => each.runId === candidate.originalRunId)?.title ??
    null,
  candidate: [candidate],
  baseline: [baseline],
  candidateSuccess:
    candidate.succeeded === null ? null : Number(candidate.succeeded),
  baselineSuccess:
    baseline.succeeded === null ? null : Number(baseline.succeeded),
  costDelta:
    candidate.cost && baseline.cost
      ? candidate.cost.amount - baseline.cost.amount
      : null,
  msDelta:
    candidate.ms !== null && baseline.ms !== null
      ? candidate.ms - baseline.ms
      : null,
  stepsDelta: null,
  scoreDelta: null,
  scoreUncompared: null,
  regressed: false,
  pair: null,
  ...over,
});

const DETAIL: ReplayDetailResponseDto = {
  ...CANDIDATE_REPLAY,
  baselineReplayId: BASELINE_ID,
  comparedWithReplayId: BASELINE_ID,
  search: null,
  comparison: [
    compared(
      CANDIDATE_ENTRIES[1] as ReplayEntryResponseDto,
      BASELINE_ENTRIES[1] as ReplayEntryResponseDto,
      {
        scoreDelta: 1,
      },
    ),
    compared(
      CANDIDATE_ENTRIES[0] as ReplayEntryResponseDto,
      BASELINE_ENTRIES[0] as ReplayEntryResponseDto,
      {
        scoreDelta: -2,
        regressed: true,
        pair: null,
      },
    ),
    compared(
      CANDIDATE_ENTRIES[2] as ReplayEntryResponseDto,
      BASELINE_ENTRIES[2] as ReplayEntryResponseDto,
      {
        scoreUncompared: 'unjudged',
      },
    ),
  ],
};

const BASELINE_DETAIL: ReplayDetailResponseDto = {
  ...BASELINE,
  baselineReplayId: BASELINE_ID,
  comparedWithReplayId: null,
  search: null,
  comparison: BASELINE_ENTRIES.map((each) => ({
    originalRunId: each.originalRunId,
    taskId: each.taskId,
    title:
      ORIGINALS.find((one) => one.runId === each.originalRunId)?.title ?? null,
    candidate: [each],
    baseline: [],
    candidateSuccess: each.succeeded === null ? null : Number(each.succeeded),
    baselineSuccess: null,
    costDelta: null,
    msDelta: null,
    stepsDelta: null,
    scoreDelta: null,
    scoreUncompared: null,
    regressed: false,
    pair: null,
  })),
};

const REPLAYABLE: ReplayableRunResponseDto[] = [
  {
    ...ORIGINALS[0],
    state: 'completed',
    endedAt: hoursAgo(28),
    refusal: null,
    reason: null,
  },
  {
    runId: 'run_cache_1',
    taskId: 'task_cache',
    title: 'Warm the pricing cache on deploy',
    state: 'completed',
    endedAt: hoursAgo(12),
    refusal: null,
    reason: null,
  },
  {
    runId: 'run_old_1',
    taskId: 'task_old',
    title: 'Rename the billing worker',
    state: 'completed',
    endedAt: hoursAgo(900),
    refusal: 'archive-gone',
    reason: 'the workspace archive it started from is no longer kept',
  },
];

const SUGGESTED: SuggestedRunResponseDto[] = [
  {
    runId: 'run_cache_1',
    taskId: 'task_cache',
    title: 'Warm the pricing cache on deploy',
    state: 'completed',
    endedAt: hoursAgo(12),
    refusal: null,
    reason: null,
    outcome: 'accepted',
  },
  {
    runId: 'run_refunds_2',
    taskId: 'task_refunds',
    title: 'Retry refunds on timeout',
    state: 'completed',
    endedAt: hoursAgo(20),
    refusal: null,
    reason: null,
    outcome: 'sent-back',
  },
];

const seedStationReplaysAround = (client: QueryClient) => {
  seedStation(client);
  client.setQueryData(teamResourceKeys.detail(TEAM_ID), TEAM);
};

export const seedStationReplays = (client: QueryClient) => {
  seedStationReplaysAround(client);
  client.setQueryData(replaySetKeys.forStation(STATION_ID), [SET, EMPTY_SET]);
  client.setQueryData(replayKeys.forSet(SET_ID), [CANDIDATE_REPLAY, BASELINE]);
  client.setQueryData(replayKeys.forSet(EMPTY_SET_ID), []);
  client.setQueryData(replayCandidateKeys.forStation(ADDRESS), CANDIDATES);
};

export const seedStationReplaysAwaiting = seedStation;

export const seedStationWithoutReplays = (client: QueryClient) => {
  seedStationReplaysAround(client);
  client.setQueryData(replaySetKeys.forStation(STATION_ID), []);
  client.setQueryData(replayCandidateKeys.forStation(ADDRESS), []);
};

export const failStationReplays = (client: QueryClient) => {
  seedStationReplaysAround(client);
  failQuery(client, replaySetKeys.forStation(STATION_ID));
  failQuery(client, replayCandidateKeys.forStation(ADDRESS));
};

export const refuseStationReplays = (client: QueryClient) => {
  seedStationReplaysAround(client);
  failQuery(client, replaySetKeys.forStation(STATION_ID), NOT_ON_TEAM);
  client.setQueryData(replayCandidateKeys.forStation(ADDRESS), []);
};

const seedSetAround = (client: QueryClient) => {
  seedStationPlace(client);
  client.setQueryData(teamResourceKeys.detail(TEAM_ID), TEAM);
  client.setQueryData(replayCandidateKeys.forStation(ADDRESS), CANDIDATES);
  client.setQueryData(replayableRunKeys.forStation(STATION_ID), REPLAYABLE);
  client.setQueryData(replaySetSuggestionKeys.forSet(SET_ID), SUGGESTED);
  client.setQueryData(replaySetSuggestionKeys.forSet(EMPTY_SET_ID), []);
};

export const seedReplaySetAwaiting = seedSetAround;

const CHECKS: ReplayCheckSummaryResponseDto[] = [
  {
    id: 'check_3',
    stationId: STATION_ID,
    stationKey: 'implementation',
    verdict: 'running',
    undecidedBecause: null,
    regressions: 0,
    attempt: 1,
    reference: { commit: '9f1c2ab7d3e4', pullRequest: 214 },
    createdAt: hoursAgo(0.3),
    replayUrl: null,
  },
  {
    id: 'check_2',
    stationId: STATION_ID,
    stationKey: 'implementation',
    verdict: 'failed',
    undecidedBecause: null,
    regressions: 2,
    attempt: 1,
    reference: { commit: '41d0e9c2b6aa', pullRequest: 209 },
    createdAt: hoursAgo(20),
    replayUrl: `/w/${SLUG}/team/${TEAM_ID}/lines/${LINE_ID}/stations/${STATION_ID}/replays/${REPLAY_ID}`,
  },
  {
    id: 'check_1',
    stationId: STATION_ID,
    stationKey: 'implementation',
    verdict: 'undecided',
    undecidedBecause: 'over-ceiling',
    regressions: 0,
    attempt: 2,
    reference: { commit: 'c07a55e1f9b2', pullRequest: null },
    createdAt: hoursAgo(28),
    replayUrl: null,
  },
];

const checksPage = (checks: ReplayCheckSummaryResponseDto[]) => ({
  pages: [checks],
  pageParams: [undefined],
});

const withThreshold = (client: QueryClient) => {
  const lines = client.getQueryData<LineResponseDto[]>(
    lineKeys.forTeam(TEAM_ID),
  );

  client.setQueryData(
    lineKeys.forTeam(TEAM_ID),
    lines?.map((line) =>
      line.id === LINE_ID
        ? {
            ...line,
            replayCheck: {
              mostRegressions: 0,
              ceiling: 10,
              currency: 'USD',
              minGain: 0.05,
            },
          }
        : line,
    ),
  );
};

const seedSetWithReplays = (client: QueryClient) => {
  seedSetAround(client);
  withThreshold(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [
    { ...SET, guardsChanges: true },
    EMPTY_SET,
  ]);
  client.setQueryData(replayKeys.forSet(SET_ID), [CANDIDATE_REPLAY, BASELINE]);
};

export const seedReplaySet = (client: QueryClient) => {
  seedSetWithReplays(client);
  client.setQueryData(replayCheckKeys.forSet(SET_ID), checksPage(CHECKS));
};

const NOISE: ReplaySetResponseDto['health']['noise'] = {
  replayId: BASELINE_ID,
  fingerprint: LIVE_FINGERPRINT,
  repeats: 3,
  perRepeat: [0.5, 0.67, 0.83],
  spread: 0.33,
  flippedTasks: [ORIGINALS[1].taskId],
  measuredAt: hoursAgo(25),
};

const UNHEALTHY: ReplaySetResponseDto['health'] = {
  noise: NOISE,
  saturation: {
    replayId: BASELINE_ID,
    rate: 0.97,
    interval: { rate: 0.97, low: 0.9, high: 1 },
    saturated: true,
    measuredAt: hoursAgo(25),
  },
  judge: {
    replayId: BASELINE_ID,
    compared: 9,
    agreed: 6,
    pending: 0,
    agreement: 0.67,
    unstable: true,
  },
  checks: {
    replayId: BASELINE_ID,
    rechecked: 9,
    pending: 0,
    flaky: [
      {
        taskId: ORIGINALS[0].taskId,
        originalRunId: ORIGINALS[0].runId,
        runId: REPLAY_RUN_ID,
        first: 'passed',
        recheck: 'failed',
      },
    ],
  },
  sanity: {
    replayId: REPLAY_ID,
    candidateId: PROPOSED.id,
    model: 'opus',
    effort: 'max',
    repeats: 1,
    state: 'finished',
    againstReplayId: BASELINE_ID,
    againstState: 'finished',
    gain: {
      gain: -0.03,
      low: -0.33,
      high: 0.33,
      verdict: 'within-noise',
      minGain: 0.05,
      tasks: 3,
    },
    rewardsStrongerModel: false,
    worse: [
      {
        taskId: ORIGINALS[1].taskId,
        originalRunId: ORIGINALS[1].runId,
        live: 1,
        stronger: 0.33,
      },
    ],
  },
};

export const seedReplaySetWithNoise = (client: QueryClient) => {
  seedReplaySet(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [
    {
      ...SET,
      guardsChanges: true,
      health: { ...SET.health, noise: NOISE },
    },
    EMPTY_SET,
  ]);
};

export const seedUnhealthyReplaySet = (client: QueryClient) => {
  seedReplaySet(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [
    { ...SET, guardsChanges: true, health: UNHEALTHY },
    EMPTY_SET,
  ]);
};

export const seedLopsidedReplaySet = (client: QueryClient) => {
  seedReplaySet(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [
    { ...LOPSIDED_SET, guardsChanges: true },
    EMPTY_SET,
  ]);
};

const seedHealth =
  (health: ReplaySetResponseDto['health']) => (client: QueryClient) => {
    seedReplaySet(client);
    client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [
      { ...SET, health },
      EMPTY_SET,
    ]);
  };

const UNHEALTHY_SANITY = UNHEALTHY.sanity as NonNullable<
  ReplaySetResponseDto['health']['sanity']
>;

export const seedReplaySetHealthPending = seedHealth({
  ...UNHEALTHY,
  judge: {
    replayId: BASELINE_ID,
    compared: 0,
    agreed: 0,
    pending: 9,
    agreement: null,
    unstable: false,
  },
  checks: { replayId: BASELINE_ID, rechecked: 0, pending: 9, flaky: [] },
  sanity: {
    ...UNHEALTHY_SANITY,
    state: 'running',
    againstState: 'running',
    gain: null,
    rewardsStrongerModel: null,
    worse: [],
  },
});

export const seedReplaySetSanityUncompared = seedHealth({
  ...UNHEALTHY,
  sanity: {
    ...UNHEALTHY_SANITY,
    againstState: 'stopped',
    gain: null,
    rewardsStrongerModel: null,
    worse: [],
  },
});

export const seedReplaySetChecksAwaiting = seedSetWithReplays;

export const failReplaySetChecks = (client: QueryClient) => {
  seedSetWithReplays(client);
  failQuery(client, replayCheckKeys.forSet(SET_ID));
};

export const seedEmptyReplaySet = (client: QueryClient) => {
  seedSetAround(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [SET, EMPTY_SET]);
  client.setQueryData(replayKeys.forSet(EMPTY_SET_ID), []);
  client.setQueryData(replayCheckKeys.forSet(EMPTY_SET_ID), checksPage([]));
};

export const seedGoneReplaySet = (client: QueryClient) => {
  seedSetAround(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [
    { ...SET, stationGone: true },
  ]);
  client.setQueryData(replayKeys.forSet(SET_ID), [
    { ...CANDIDATE_REPLAY, state: 'stopped', endedAt: hoursAgo(0.5) },
    BASELINE,
  ]);
};

export const failReplaySet = (client: QueryClient) => {
  seedSetAround(client);
  failQuery(client, replaySetKeys.forTeam(TEAM_ID));
};

const seedReplayAround = (client: QueryClient) => {
  seedStationPlace(client);
  client.setQueryData(replaySetKeys.forTeam(TEAM_ID), [SET, EMPTY_SET]);
  client.setQueryData(replayKeys.forSet(SET_ID), [CANDIDATE_REPLAY, BASELINE]);
};

export const seedReplayAwaiting = seedReplayAround;

export const seedReplay = (client: QueryClient) => {
  seedReplayAround(client);
  client.setQueryData(replayKeys.detail(REPLAY_ID), DETAIL);
};

const copiesOf = (
  first: ReplayEntryResponseDto,
  results: readonly ReplayEntryResponseDto['result'][],
): ReplayEntryResponseDto[] =>
  results.map((result, place) => ({
    ...first,
    repeat: place + 1,
    runId: first.runId ? `${first.runId}_${place + 1}` : null,
    result,
    succeeded:
      result === 'succeeded' ? true : result === 'failed' ? false : null,
  }));

const REPEATED_COMPARISON: EntryComparisonResponseDto[] = DETAIL.comparison.map(
  (row, place) => {
    const [candidate] = row.candidate;
    const [baseline] = row.baseline;

    if (!candidate || !baseline || candidate.result === 'unscored') {
      return row;
    }

    const candidateResults: ReplayEntryResponseDto['result'][] =
      place === 1
        ? ['failed', 'failed', 'succeeded']
        : ['succeeded', 'failed', 'succeeded'];
    const baselineResults: ReplayEntryResponseDto['result'][] =
      place === 1
        ? ['succeeded', 'succeeded', 'succeeded']
        : ['failed', 'failed', 'succeeded'];

    return {
      ...row,
      candidate: copiesOf(candidate, candidateResults),
      baseline: copiesOf(baseline, baselineResults),
      candidateSuccess: place === 1 ? 1 / 3 : 2 / 3,
      baselineSuccess: place === 1 ? 1 : 1 / 3,
    };
  },
);

export const seedRepeatedReplay = (client: QueryClient) => {
  seedReplayAround(client);
  client.setQueryData(replayKeys.detail(REPLAY_ID), {
    ...DETAIL,
    repeats: 3,
    totals: totals({
      entries: 9,
      settled: 9,
      completed: 6,
      succeeded: 3,
      successRate: 0.5,
      interval: { rate: 0.5, low: 0.33, high: 0.67 },
      scored: 6,
      tasks: 3,
      tasksScored: 2,
      unscored: 3,
    }),
    againstBaseline: {
      gain: -0.17,
      low: -0.67,
      high: 0.33,
      verdict: 'within-noise',
      minGain: 0.05,
      tasks: 2,
    },
    pairsAgainstBaseline: null,
    comparison: REPEATED_COMPARISON,
  } satisfies ReplayDetailResponseDto);
};

const ENTRY_CLAIMS = [
  'Retries stop on a 410 Gone',
  'Every other failure is retried later',
  'The queue is drained',
];

const CLAIMS_JUDGE = (marks: boolean[]): ReplayEntryResponseDto['judge'] => ({
  state: 'judged',
  scale: 'claims',
  score: marks.filter(Boolean).length / marks.length,
  passed: marks.every(Boolean),
  marks,
  passShare: 1,
  referenced: true,
  model: 'anthropic/claude-opus-5',
  unjudged: null,
  claims: ENTRY_CLAIMS,
  reasons: [
    {
      text: 'The change returns early on a 410, so those jobs are not retried.',
      claim: 0,
      citations: [
        {
          kind: 'hunk',
          step: null,
          hunk: {
            id: 'worker/services/retry.ts#1',
            path: null,
            header: null,
            lines: [],
          },
        },
      ],
    },
    {
      text: 'Other failures are dropped instead of being queued for later.',
      claim: 1,
      citations: [
        {
          kind: 'step',
          step: { index: 2, kind: null, tool: null, text: null },
          hunk: null,
        },
      ],
    },
  ],
});

const PAIR: NonNullable<ReplayEntryResponseDto['pair']> = {
  state: 'judged',
  againstRunId: 'run_replay_drain_baseline',
  outcome: 'tie',
  model: 'anthropic/claude-opus-5',
  unpaired: null,
  readings: [
    {
      ownShownFirst: true,
      outcome: 'win',
      reasons: [
        {
          text: 'Like the accepted change, it stops retrying on a 410.',
          ownHunks: ['worker/services/retry.ts#1'],
          theirHunks: [],
        },
      ],
    },
    {
      ownShownFirst: false,
      outcome: 'loss',
      reasons: [
        {
          text: 'The other change keeps later retries for other failures, as the accepted one does.',
          ownHunks: [],
          theirHunks: ['worker/services/retry.ts#1', 'worker/queue.ts#2'],
        },
      ],
    },
  ],
};

const judgedByClaims = (
  entry: ReplayEntryResponseDto,
  marks: boolean[],
): ReplayEntryResponseDto =>
  entry.judge?.state === 'judged'
    ? { ...entry, judge: CLAIMS_JUDGE(marks) }
    : entry;

const PAIRS: EntryComparisonResponseDto['pair'][] = ['win', 'loss', null];

const PAIRED_ENTRY_CLAIMS = [true, false, true];

const PAIRED_COMPARISON: EntryComparisonResponseDto[] = DETAIL.comparison.map(
  (row, place) => ({
    ...row,
    candidate: row.candidate.map((each) =>
      judgedByClaims(each, PAIRED_ENTRY_CLAIMS),
    ),
    baseline: row.baseline.map((each) =>
      judgedByClaims(each, [true, false, false]),
    ),
    pair: PAIRS[place] ?? null,
  }),
);

export const seedPairedReplay = (client: QueryClient) => {
  seedReplayAround(client);
  client.setQueryData(replayKeys.detail(REPLAY_ID), {
    ...DETAIL,
    pairsAgainstBaseline: { wins: 1, losses: 1, ties: 0 },
    entries: DETAIL.entries.map((each) => ({
      ...each,
      pairingSpent: {
        spends: [{ amount: 0.04, currency: 'USD' }],
        unpriced: 0,
      },
    })),
    comparison: PAIRED_COMPARISON,
  } satisfies ReplayDetailResponseDto);
};

export const seedBaselineReplay = (client: QueryClient) => {
  seedReplayAround(client);
  client.setQueryData(replayKeys.detail(BASELINE_ID), BASELINE_DETAIL);
};

export const seedEmptyReplay = (client: QueryClient) => {
  seedReplayAround(client);
  client.setQueryData(replayKeys.detail(REPLAY_ID), {
    ...DETAIL,
    state: 'over-budget',
    entries: [],
    comparison: [],
    totals: totals({
      entries: 0,
      settled: 0,
      completed: 0,
      succeeded: null,
      successRate: null,
      scored: 0,
      unscored: 0,
      spent: { amount: 0, currency: 'USD' },
    }),
  } satisfies ReplayDetailResponseDto);
};

export const failReplay = (client: QueryClient) => {
  seedReplayAround(client);
  failQuery(client, replayKeys.detail(REPLAY_ID));
};

const REPLAY_RUN: ReplayRunResponseDto = {
  id: REPLAY_RUN_ID,
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: hoursAgo(0.8),
  updatedAt: hoursAgo(0.6),
  harness: 'claude-code',
  image: null,
  station: {
    id: STATION_ID,
    name: 'Implementation',
    color: '#5c66d9',
    position: 2,
    count: 4,
  },
  review: null,
  original: ORIGINALS[0],
  spend: {
    cost: 0.72,
    currency: 'USD',
    inputTokens: 3_100,
    outputTokens: 14_200,
    cacheReadTokens: 812_000,
    cacheWriteTokens: 41_000,
  },
  journals: [
    {
      runId: REPLAY_RUN_ID,
      attempt: 1,
      ms: 420_000,
      spans: [],
      marks: {
        startedAt: hoursAgo(0.8),
        readyAt: null,
        spokeFrom: null,
        spokeTo: null,
        endedAt: hoursAgo(0.6),
      },
      spent: { used: 48_000, size: 200_000, cost: null, currency: null },
      steps: [
        {
          kind: 'thought',
          status: null,
          tool: null,
          text: 'Drain the webhook queue first.',
          detail: null,
          ms: 900,
          startedAt: hoursAgo(0.79),
          locations: [],
          given: null,
          returned: null,
          change: null,
        },
        {
          kind: 'tool',
          status: 'completed',
          tool: 'execute',
          text: 'queue-drain webhook-retries',
          detail: 'replayed 1201\nfailed 3 (410 Gone)',
          ms: 8_200,
          startedAt: hoursAgo(0.78),
          locations: [],
          given: null,
          returned: null,
          change: null,
        },
      ],
    },
  ],
};

const REPLAY_OF_RUN: ReplayOfRunResponseDto = {
  replayId: REPLAY_ID,
  setId: SET_ID,
  setName: SET.name,
  lineId: LINE_ID,
  stationId: STATION_ID,
  candidate: replayed(PROPOSED),
  startedAsBaseline: false,
  isBaseline: false,
  state: 'running',
  search: null,
  entry: CANDIDATE_ENTRIES[0] as ReplayEntryResponseDto,
};

const seedReplayRunAround = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(teamRunKeys.forTeam(TEAM_ID), []);
  client.setQueryData(runConfigKeys.forRun(REPLAY_RUN_ID), {
    fingerprint: CANDIDATE_FINGERPRINT,
    config: null,
    changedSince: null,
  });
};

export const seedReplayRunAwaiting = seedReplayRunAround;

export const seedReplayRun = (client: QueryClient) => {
  seedReplayRunAround(client);
  client.setQueryData(replayRunKeys.forRun(REPLAY_RUN_ID), REPLAY_RUN);
  client.setQueryData(replayRunKeys.replayOf(REPLAY_RUN_ID), REPLAY_OF_RUN);
};

export const seedClaimsReplayRun = (client: QueryClient) => {
  seedReplayRunAround(client);
  client.setQueryData(replayRunKeys.forRun(REPLAY_RUN_ID), REPLAY_RUN);
  client.setQueryData(replayRunKeys.replayOf(REPLAY_RUN_ID), {
    ...REPLAY_OF_RUN,
    entry: {
      ...judgedByClaims(
        CANDIDATE_ENTRIES[0] as ReplayEntryResponseDto,
        PAIRED_ENTRY_CLAIMS,
      ),
      pair: PAIR,
    },
  } satisfies ReplayOfRunResponseDto);
};

export const seedEmptyReplayRun = (client: QueryClient) => {
  seedReplayRunAround(client);
  client.setQueryData(replayRunKeys.forRun(REPLAY_RUN_ID), {
    ...REPLAY_RUN,
    state: 'failed',
    exitCode: 1,
    spend: null,
    journals: [],
  } satisfies ReplayRunResponseDto);
  client.setQueryData(replayRunKeys.replayOf(REPLAY_RUN_ID), REPLAY_OF_RUN);
};

export const failReplayRun = (client: QueryClient) => {
  seedReplayRunAround(client);
  failQuery(client, replayRunKeys.forRun(REPLAY_RUN_ID));
};
