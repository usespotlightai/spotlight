import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { insightsCostKeys } from '@/hooks/api/useInsightsCost';
import { insightsFlowKeys } from '@/hooks/api/useInsightsFlow';
import { insightsOverviewKeys } from '@/hooks/api/useInsightsOverview';
import { insightsPeopleKeys } from '@/hooks/api/useInsightsPeople';
import { insightsRunKeys } from '@/hooks/api/useInsightsRuns';
import { insightsStationsKeys } from '@/hooks/api/useInsightsStations';
import { lineKeys } from '@/hooks/api/useLines';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  InsightsPeriodResponseDto,
  LineResponseDto,
  RunTallyResponseDto,
  SpreadResponseDto,
  StationResponseDto,
} from '@/lib/api';
import {
  DEFAULT_PERIOD,
  type Headline,
  type InsightsCost,
  type InsightsFlow,
  type InsightsOverview,
  type InsightsPeople,
  type InsightsRun,
  type InsightsRuns,
  type InsightsStations,
} from '@/lib/insights';
import type { MeasureVerdict } from '@/lib/tally-comparison';
import { teamSectionPath } from '@/lib/team';
import { failQuery } from '@/stories/failQuery';
import { NOT_ON_TEAM, SLUG, TEAM_ID, WORKSPACE } from '@/stories/fixtures/team';

export const insightsAt = (tab: string): string =>
  `${teamSectionPath(SLUG, TEAM_ID, 'insights')}?tab=${tab}`;

export const LINE_ID = 'line_delivery';

const station = (
  over: Partial<StationResponseDto> & {
    id: string;
    name: string;
    position: number;
  },
): StationResponseDto => ({
  key: over.name.toLowerCase(),
  color: '#5c66d9',
  description: null,
  harness: 'claude-code',
  model: null,
  effort: null,
  agentPrompt: null,
  judge: null,
  alerts: [],
  kind: 'work',
  skills: [],
  ...over,
});

const LINES: LineResponseDto[] = [
  {
    id: LINE_ID,
    key: 'delivery',
    name: 'Delivery',
    reactions: [],
    repositories: ['acme/api', 'acme/web'],
    source: null,
    replayCheck: null,
    stations: [
      station({
        id: 'station_backlog',
        name: 'Backlog',
        position: 0,
        kind: 'backlog',
      }),
      station({
        id: 'station_triage',
        name: 'Triage',
        position: 1,
        color: '#edc12b',
      }),
      station({
        id: 'station_spec',
        name: 'Spec',
        position: 2,
        color: '#b36ae2',
      }),
      station({
        id: 'station_implementation',
        name: 'Implementation',
        position: 3,
      }),
      station({
        id: 'station_review',
        name: 'Code Review',
        position: 4,
        color: '#56b98d',
      }),
      station({
        id: 'station_done',
        name: 'Done',
        position: 5,
        kind: 'completed',
      }),
    ],
  },
];

const HARNESSES: HarnessResponseDto[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [
      { id: 'opus', name: 'Opus' },
      { id: 'sonnet', name: 'Sonnet' },
    ],
    defaultModel: 'sonnet',
    efforts: ['low', 'medium', 'high'],
  },
  { id: 'cursor', name: 'Cursor', models: [], defaultModel: '', efforts: [] },
];

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const midnight = (at: number): number => Math.floor(at / DAY_MS) * DAY_MS;

const dayAt = (at: number): string => new Date(at).toISOString().slice(0, 10);

const periodOf = (count: number): InsightsPeriodResponseDto => {
  const to = midnight(Date.now()) + DAY_MS;
  const from = to - count * DAY_MS;

  return {
    name: DEFAULT_PERIOD,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    previousFrom: new Date(from - count * DAY_MS).toISOString(),
    previousTo: new Date(from).toISOString(),
    days: Array.from({ length: count }, (_, at) => dayAt(from + at * DAY_MS)),
  };
};

export const PERIOD = periodOf(30);

export const daysAgo = (days: number, hours = 12): string =>
  new Date(
    midnight(Date.now()) - days * DAY_MS + hours * HOUR_MS,
  ).toISOString();

export const spread = (
  p50Ms: number | null,
  p90Ms: number | null,
  count: number,
): SpreadResponseDto => ({ p50Ms, p90Ms, count });

const PEOPLE = [
  { personId: 'user_1', name: 'Sam Rivera' },
  { personId: 'user_2', name: 'Ada Lovelace' },
  { personId: 'user_3', name: null },
];

const headline = (over: Partial<Headline>): Headline => ({
  spend: { amount: 184.32, currency: 'USD' },
  unpriced: 6,
  mixedCurrencies: false,
  runs: 212,
  tasks: 64,
  mergedPullRequests: 23,
  closedPullRequests: 4,
  mergeRate: 23 / 27,
  costPerMerge: { amount: 8.01, currency: 'USD' },
  taskToMerge: spread(26 * HOUR_MS, 3 * DAY_MS, 23),
  touches: 190,
  touchesPerTask: 190 / 64,
  activePeople: 3,
  mergedTaskIds: [],
  peopleIds: ['user_1', 'user_2', 'user_3'],
  ...over,
});

const wave = (at: number, low: number, high: number): number =>
  Math.round(low + ((Math.sin(at / 2.3) + 1) / 2) * (high - low));

const OVERVIEW: InsightsOverview = {
  period: PERIOD,
  truncated: false,
  headline: headline({}),
  before: headline({
    spend: { amount: 151.1, currency: 'USD' },
    runs: 170,
    mergedPullRequests: 17,
    mergeRate: 17 / 24,
    costPerMerge: { amount: 8.89, currency: 'USD' },
    taskToMerge: spread(31 * HOUR_MS, 4 * DAY_MS, 17),
    touchesPerTask: 3.4,
    activePeople: 2,
  }),
  output: PERIOD.days.map((day, at) => ({
    day,
    runs: wave(at, 2, 12),
    spend: { amount: wave(at + 1, 200, 1100) / 100, currency: 'USD' },
    merged: wave(at + 3, 0, 2),
    mergedTaskIds: [],
    unpriced: 0,
    mixedCurrencies: false,
  })),
  outputCurrency: 'USD',
  outputMixedCurrencies: false,
  configChanges: [
    {
      lineId: LINE_ID,
      stationId: 'station_implementation',
      fingerprint:
        'b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c93f2a9c1e',
      firstRunAt: daysAgo(18),
      runId: 'run_implementation_1',
    },
    {
      lineId: LINE_ID,
      stationId: 'station_review',
      fingerprint:
        'c81e4f07a2d6b9e3f5a7c1d3e5b7a9f1c3e5d7b9a1f3c5e7d9b1a3f5c7e9d1b3',
      firstRunAt: daysAgo(6),
      runId: 'run_review_1',
    },
  ],
  worthImproving: [
    {
      lineId: LINE_ID,
      stationId: 'station_implementation',
      runs: 88,
      signals: [
        {
          signal: 'sent-back',
          now: 0.31,
          before: 0.12,
          team: 0.18,
          rose: true,
          trails: true,
          currency: null,
        },
        {
          signal: 'cost',
          now: 1.42,
          before: 0.96,
          team: 0.87,
          rose: true,
          trails: true,
          currency: 'USD',
        },
      ],
      worstBy: 2.6,
      mixedCurrencies: false,
    },
    {
      lineId: LINE_ID,
      stationId: 'station_triage',
      runs: 41,
      signals: [
        {
          signal: 'task-failures',
          now: 0.2,
          before: 0.05,
          team: 0.08,
          rose: true,
          trails: true,
          currency: null,
        },
      ],
      worstBy: 4,
      mixedCurrencies: false,
    },
  ],
  people: PEOPLE,
};

const EMPTY_OVERVIEW: InsightsOverview = {
  ...OVERVIEW,
  headline: headline({
    spend: null,
    runs: 0,
    tasks: 0,
    mergedPullRequests: 0,
    closedPullRequests: 0,
    mergeRate: null,
    costPerMerge: null,
    taskToMerge: spread(null, null, 0),
    touches: 0,
    touchesPerTask: null,
    activePeople: 0,
    peopleIds: [],
  }),
  output: PERIOD.days.map((day) => ({
    day,
    runs: 0,
    spend: null,
    merged: 0,
    mergedTaskIds: [],
    unpriced: 0,
    mixedCurrencies: false,
  })),
  outputCurrency: null,
  outputMixedCurrencies: false,
  configChanges: [],
  worthImproving: [],
  people: [],
};

const stationFlow = (
  stationId: string,
  tasks: number,
  queuedMs: number,
  runningMs: number,
  inboxMs: number | null,
  asks: number,
) => ({
  lineId: LINE_ID,
  stationId,
  tasks,
  taskIds: [],
  runs: Math.round(tasks * 1.4),
  queued: spread(queuedMs, queuedMs * 3, tasks),
  running: spread(runningMs, runningMs * 2, tasks),
  inbox: spread(inboxMs, inboxMs === null ? null : inboxMs * 4, asks),
  asks,
  unanswered: asks > 0 ? 1 : 0,
});

const FLOW: InsightsFlow = {
  period: PERIOD,
  truncated: false,
  flow: {
    stations: [
      stationFlow('station_triage', 58, 40_000, 95_000, 20 * 60_000, 12),
      stationFlow('station_spec', 44, 65_000, 240_000, 3 * HOUR_MS, 30),
      stationFlow(
        'station_implementation',
        39,
        90_000,
        780_000,
        5 * HOUR_MS,
        22,
      ),
      stationFlow('station_review', 31, 30_000, 310_000, null, 0),
    ],
    delivery: {
      toPullRequest: spread(20 * HOUR_MS, 2 * DAY_MS, 27),
      toFirstReview: spread(3 * HOUR_MS, 11 * HOUR_MS, 25),
      toMerge: spread(5 * HOUR_MS, 20 * HOUR_MS, 23),
      opened: 27,
      reviewed: 25,
      merged: 23,
      openedTaskIds: [],
      reviewedTaskIds: ['task_run_impl_9', 'task_run_spec_4'],
      mergedTaskIds: [],
    },
  },
  before: {
    stations: [
      stationFlow('station_triage', 50, 40_000, 95_000, 20 * 60_000, 10),
      stationFlow('station_spec', 40, 65_000, 240_000, 3 * HOUR_MS, 30),
      stationFlow(
        'station_implementation',
        33,
        90_000,
        780_000,
        5 * HOUR_MS,
        22,
      ),
    ],
    delivery: {
      toPullRequest: spread(22 * HOUR_MS, 3 * DAY_MS, 20),
      toFirstReview: spread(4 * HOUR_MS, 12 * HOUR_MS, 19),
      toMerge: spread(6 * HOUR_MS, 22 * HOUR_MS, 17),
      opened: 20,
      reviewed: 19,
      merged: 17,
      openedTaskIds: [],
      reviewedTaskIds: [],
      mergedTaskIds: [],
    },
  },
};

const EMPTY_FLOW: InsightsFlow = {
  period: PERIOD,
  truncated: false,
  flow: {
    stations: [],
    delivery: {
      toPullRequest: spread(null, null, 0),
      toFirstReview: spread(null, null, 0),
      toMerge: spread(null, null, 0),
      opened: 0,
      reviewed: 0,
      merged: 0,
      openedTaskIds: [],
      reviewedTaskIds: [],
      mergedTaskIds: [],
    },
  },
  before: {
    stations: [],
    delivery: {
      toPullRequest: spread(null, null, 0),
      toFirstReview: spread(null, null, 0),
      toMerge: spread(null, null, 0),
      opened: 0,
      reviewed: 0,
      merged: 0,
      openedTaskIds: [],
      reviewedTaskIds: [],
      mergedTaskIds: [],
    },
  },
};

export const tally = (
  over: Partial<RunTallyResponseDto>,
): RunTallyResponseDto => ({
  runs: 0,
  withdrawn: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 0,
  sentBack: 0,
  handedOn: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
  ...over,
});

export const measured = (
  measure: MeasureVerdict['measure'],
  before: number | null,
  after: number | null,
  verdict: MeasureVerdict['verdict'],
  settled: { before?: number; after?: number; currency?: string } = {},
): MeasureVerdict => ({
  measure,
  before,
  after,
  settledBefore: settled.before ?? 20,
  settledAfter: settled.after ?? 20,
  currency: measure === 'cost_per_run' ? (settled.currency ?? 'USD') : null,
  verdict,
});

const report = (
  stationId: string,
  now: Partial<RunTallyResponseDto>,
  over: Partial<InsightsStations['stations'][number]> = {},
) => ({
  lineId: LINE_ID,
  stationId,
  tally: tally(now),
  before: tally({ ...now, runs: Math.round((now.runs ?? 0) * 0.8) }),
  trend: PERIOD.days.map((day, at) => ({
    day,
    tally: tally({
      runs: wave(at + stationId.length, 0, 6),
      failed: wave(at, 0, 1),
    }),
  })),
  taskFailures: [],
  runFailures: [],
  ...over,
});

const STATIONS: InsightsStations = {
  period: PERIOD,
  truncated: false,
  team: tally({
    runs: 212,
    failed: 14,
    stopped: 3,
    checksPassed: 61,
    checksFailed: 9,
    accepted: 70,
    sentBack: 22,
    handedOn: 140,
    merged: 23,
    cost: { amount: 184.32, currency: 'USD' },
    medianMs: 240_000,
    p90Ms: 900_000,
  }),
  teamBefore: tally({ runs: 170 }),
  stations: [
    report(
      'station_triage',
      {
        runs: 58,
        failed: 2,
        handedOn: 55,
        cost: { amount: 11.4, currency: 'USD' },
        medianMs: 95_000,
        p90Ms: 190_000,
      },
      {
        taskFailures: [
          {
            source: 'hook:notify',
            code: 'loop',
            occurrences: 3,
            mostInARow: 3,
            taskIds: ['task_checkout'],
          },
        ],
        runFailures: [
          {
            failure: 'The agent ran out of turns',
            runs: 2,
            runIds: ['run_triage_7', 'run_triage_9'],
          },
        ],
      },
    ),
    report('station_spec', {
      runs: 61,
      sentBack: 9,
      accepted: 30,
      handedOn: 40,
      cost: { amount: 38.7, currency: 'USD' },
      medianMs: 240_000,
      p90Ms: 520_000,
    }),
    report(
      'station_implementation',
      {
        runs: 88,
        failed: 12,
        stopped: 3,
        checksPassed: 61,
        checksFailed: 9,
        sentBack: 13,
        accepted: 40,
        handedOn: 45,
        merged: 23,
        cost: { amount: 124.9, currency: 'USD' },
        medianMs: 780_000,
        p90Ms: 1_900_000,
      },
      {
        runFailures: [
          {
            failure: 'Checks failed three times',
            runs: 9,
            runIds: [],
          },
          { failure: null, runs: 3, runIds: ['run_impl_3'] },
        ],
      },
    ),
  ],
};

const EMPTY_STATIONS: InsightsStations = {
  period: PERIOD,
  truncated: false,
  team: tally({}),
  teamBefore: tally({}),
  stations: [],
};

const load = (over: Partial<InsightsPeople['load']>) => ({
  asks: 64,
  tasks: 64,
  asksPerTask: 1,
  toAnswer: spread(42 * 60_000, 6 * HOUR_MS, 60),
  unanswered: 4,
  sentBack: 22,
  sentBackRate: 22 / 212,
  refused: 2,
  askedTaskIds: [],
  refusedTaskIds: [],
  ...over,
});

const PEOPLE_INSIGHTS: InsightsPeople = {
  period: PERIOD,
  truncated: false,
  load: load({}),
  loadBefore: load({
    asksPerTask: 1.3,
    toAnswer: spread(70 * 60_000, 9 * HOUR_MS, 50),
    sentBackRate: 0.14,
    refused: 1,
  }),
  adoption: {
    active: ['user_1', 'user_2', 'user_3'],
    activeBefore: ['user_1', 'user_2'],
    newAdopters: ['user_3'],
    weekly: ['user_1', 'user_2'],
    monthly: ['user_1', 'user_2', 'user_3'],
    stickiness: 2 / 3,
    people: [
      {
        personId: 'user_1',
        name: 'Sam Rivera',
        tasksOpened: 31,
        acts: 120,
        chats: 6,
        firstSeenAt: daysAgo(80),
        lastActiveAt: daysAgo(0, 9),
        isNew: false,
      },
      {
        personId: 'user_2',
        name: 'Ada Lovelace',
        tasksOpened: 25,
        acts: 61,
        chats: 2,
        firstSeenAt: daysAgo(45),
        lastActiveAt: daysAgo(2),
        isNew: false,
      },
      {
        personId: 'user_3',
        name: null,
        tasksOpened: 8,
        acts: 9,
        chats: 0,
        firstSeenAt: daysAgo(12),
        lastActiveAt: daysAgo(10),
        isNew: true,
      },
    ],
  },
  people: PEOPLE,
};

const EMPTY_PEOPLE: InsightsPeople = {
  period: PERIOD,
  truncated: false,
  load: load({
    asks: 0,
    tasks: 0,
    asksPerTask: null,
    toAnswer: spread(null, null, 0),
    unanswered: 0,
    sentBack: 0,
    sentBackRate: null,
    refused: 0,
  }),
  loadBefore: load({ tasks: 0 }),
  adoption: {
    active: [],
    activeBefore: [],
    newAdopters: [],
    weekly: [],
    monthly: [],
    stickiness: null,
    people: [],
  },
  people: [],
};

const COST: InsightsCost = {
  period: PERIOD,
  truncated: false,
  cost: {
    spend: { amount: 184.32, currency: 'USD' },
    unpriced: 6,
    mixedCurrencies: false,
    byHarness: [
      { key: 'claude-code', amount: 162.1, runs: 180 },
      { key: 'cursor', amount: 22.22, runs: 26 },
    ],
    byModel: [
      { key: 'opus', amount: 131.4, runs: 96 },
      { key: 'sonnet', amount: 30.7, runs: 84 },
      { key: null, amount: 22.22, runs: 26 },
    ],
    byStation: [
      { key: 'station_implementation', amount: 124.9, runs: 88 },
      { key: 'station_spec', amount: 38.7, runs: 61 },
      { key: 'station_triage', amount: 11.4, runs: 58 },
      { key: 'station_review', amount: 9.32, runs: 5 },
    ],
    byRepository: [
      { key: 'acme/api', amount: 121.6, runs: 130 },
      { key: 'acme/web', amount: 51.3, runs: 62 },
      { key: null, amount: 11.42, runs: 14 },
    ],
    nodes: [
      { id: 'model:opus', kind: 'model', key: 'opus' },
      { id: 'model:sonnet', kind: 'model', key: 'sonnet' },
      { id: 'model:', kind: 'model', key: null },
      { id: 'station:impl', kind: 'station', key: 'station_implementation' },
      { id: 'station:spec', kind: 'station', key: 'station_spec' },
      { id: 'station:triage', kind: 'station', key: 'station_triage' },
      { id: 'repo:api', kind: 'repository', key: 'acme/api' },
      { id: 'repo:web', kind: 'repository', key: 'acme/web' },
      { id: 'repo:', kind: 'repository', key: null },
    ],
    links: [
      { source: 'model:opus', target: 'station:impl', amount: 112.4 },
      { source: 'model:opus', target: 'station:spec', amount: 19 },
      { source: 'model:sonnet', target: 'station:spec', amount: 19.7 },
      { source: 'model:sonnet', target: 'station:triage', amount: 11 },
      { source: 'model:', target: 'station:impl', amount: 12.5 },
      { source: 'station:impl', target: 'repo:api', amount: 88.9 },
      { source: 'station:impl', target: 'repo:web', amount: 36 },
      { source: 'station:spec', target: 'repo:api', amount: 23.4 },
      { source: 'station:spec', target: 'repo:web', amount: 15.3 },
      { source: 'station:triage', target: 'repo:', amount: 11 },
    ],
    cache: {
      input: 4_200_000,
      cacheRead: 9_800_000,
      cacheWrite: 1_400_000,
      cacheShare: 0.64,
    },
    cacheByStation: [
      {
        stationId: 'station_implementation',
        input: 2_900_000,
        cacheRead: 7_600_000,
        cacheWrite: 200_000,
        cacheShare: 0.72,
      },
      {
        stationId: 'station_spec',
        input: 1_300_000,
        cacheRead: 2_200_000,
        cacheWrite: 200_000,
        cacheShare: 0.63,
      },
      {
        stationId: 'station_triage',
        input: null,
        cacheRead: null,
        cacheWrite: null,
        cacheShare: null,
      },
    ],
  },
  spendBefore: { amount: 151.1, currency: 'USD' },
  mixedCurrenciesBefore: false,
};

const EMPTY_COST: InsightsCost = {
  period: PERIOD,
  truncated: false,
  cost: {
    spend: null,
    unpriced: 0,
    mixedCurrencies: false,
    byHarness: [],
    byModel: [],
    byStation: [],
    byRepository: [],
    nodes: [],
    links: [],
    cache: { input: null, cacheRead: null, cacheWrite: null, cacheShare: null },
    cacheByStation: [],
  },
  spendBefore: null,
  mixedCurrenciesBefore: false,
};

const run = (
  over: Partial<InsightsRun> & { runId: string; stationId: string },
): InsightsRun => ({
  taskId: `task_${over.runId}`,
  lineId: LINE_ID,
  fingerprint:
    'b7d4a60c8e2f1a9b3d5c7e9f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c93f2a9c1e',
  harness: 'claude-code',
  model: 'opus',
  effort: 'high',
  profileKey: null,
  repositories: ['acme/api'],
  openedBy: 'user_1',
  queuedAt: daysAgo(0, 8),
  startedAt: daysAgo(0, 8),
  endedAt: daysAgo(0, 9),
  queuedMs: 40_000,
  runningMs: 312_000,
  ms: 312_000,
  cost: { amount: 1.84, currency: 'USD' },
  tokens: null,
  ending: 'completed',
  failure: null,
  checks: 'passed',
  next: null,
  handedOn: null,
  delivery: null,
  ...over,
});

const RUNS: InsightsRuns = {
  period: PERIOD,
  total: 212,
  page: 1,
  size: 50,
  runs: [
    run({ runId: 'run_impl_9', stationId: 'station_implementation' }),
    run({
      runId: 'run_impl_8',
      stationId: 'station_implementation',
      ending: 'failed',
      failure: 'Checks failed three times',
      openedBy: 'user_2',
      ms: 1_210_000,
      cost: { amount: 3.12, currency: 'USD' },
      endedAt: daysAgo(1, 15),
    }),
    run({
      runId: 'run_spec_4',
      stationId: 'station_spec',
      model: 'sonnet',
      ms: 240_000,
      cost: { amount: 0.61, currency: 'USD' },
      endedAt: daysAgo(1, 11),
    }),
    run({
      runId: 'run_triage_9',
      stationId: 'station_triage',
      harness: 'cursor',
      model: null,
      ending: 'failed',
      failure: 'The agent ran out of turns',
      openedBy: null,
      ms: 95_000,
      cost: null,
      endedAt: daysAgo(2, 10),
    }),
    run({
      runId: 'run_review_2',
      stationId: 'station_review',
      ending: 'stopped',
      openedBy: 'user_3',
      ms: 60_000,
      cost: { amount: 0.22, currency: 'USD' },
      endedAt: daysAgo(3, 10),
    }),
  ],
  people: PEOPLE,
};

const EMPTY_RUNS: InsightsRuns = {
  period: PERIOD,
  total: 0,
  page: 1,
  size: 50,
  runs: [],
  people: [],
};

const seedTeam = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
};

const OVERVIEW_KEY = insightsOverviewKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);
const FLOW_KEY = insightsFlowKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);
const STATIONS_KEY = insightsStationsKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);
const PEOPLE_KEY = insightsPeopleKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);
const COST_KEY = insightsCostKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);
const RUNS_KEY = insightsRunKeys.forTeam(TEAM_ID, DEFAULT_PERIOD, {}, 1);

const seeding =
  (key: readonly unknown[], data: unknown) => (client: QueryClient) => {
    seedTeam(client);
    client.setQueryData(key, data);
  };

const failing =
  (key: readonly unknown[], error?: Error) => (client: QueryClient) => {
    seedTeam(client);
    failQuery(client, key, error);
  };

export const loadInsights = seedTeam;

export const seedOverview = seeding(OVERVIEW_KEY, OVERVIEW);
export const emptyOverview = seeding(OVERVIEW_KEY, EMPTY_OVERVIEW);
export const failOverview = failing(OVERVIEW_KEY);
export const refuseOverview = failing(OVERVIEW_KEY, NOT_ON_TEAM);

export const seedFlow = seeding(FLOW_KEY, FLOW);
export const emptyFlow = seeding(FLOW_KEY, EMPTY_FLOW);
export const failFlow = failing(FLOW_KEY);

export const seedStations = seeding(STATIONS_KEY, STATIONS);
export const emptyStations = seeding(STATIONS_KEY, EMPTY_STATIONS);
export const failStations = failing(STATIONS_KEY);

export const seedPeople = seeding(PEOPLE_KEY, PEOPLE_INSIGHTS);
export const emptyPeople = seeding(PEOPLE_KEY, EMPTY_PEOPLE);
export const failPeople = failing(PEOPLE_KEY);

export const seedCost = seeding(COST_KEY, COST);
export const emptyCost = seeding(COST_KEY, EMPTY_COST);
export const failCost = failing(COST_KEY);

export const seedRuns = seeding(RUNS_KEY, RUNS);
export const emptyRuns = seeding(RUNS_KEY, EMPTY_RUNS);
export const failRuns = failing(RUNS_KEY);
