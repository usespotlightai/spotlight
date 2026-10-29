import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { insightsStationsKeys } from '@/hooks/api/useInsightsStations';
import { lineKeys } from '@/hooks/api/useLines';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  InsightsPeriodResponseDto,
  LineResponseDto,
  RunTallyResponseDto,
  StationResponseDto,
  TallyDeltasResponseDto,
} from '@/lib/api';
import {
  DEFAULT_PERIOD,
  type Delta,
  type InsightsStations,
} from '@/lib/insights';
import { onGitHub } from '@/mocks/world/repositories';
import { LINE_SEARCH } from '@/mocks/world/stations';
import { SLUG, TEAM_ID, WORKSPACE } from '@/test/fixtures/team';

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
  search: null,
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
    repositories: [onGitHub('acme/api'), onGitHub('acme/web')],
    source: null,
    replayCheck: null,
    search: LINE_SEARCH,
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

const INSIGHTS_HARNESSES: HarnessResponseDto[] = [
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

const change = (
  by: number | null,
  tone: Delta['tone'] = 'flat',
  unit: Delta['unit'] = 'percent',
): Delta => ({
  unit,
  by,
  fromZero: by === null,
  direction: by === null || by > 0 ? 'up' : by < 0 ? 'down' : 'same',
  tone: by === 0 ? 'flat' : tone,
});

const NO_CHANGE = change(0);

const wave = (at: number, low: number, high: number): number =>
  Math.round(low + ((Math.sin(at / 2.3) + 1) / 2) * (high - low));

const tally = (over: Partial<RunTallyResponseDto>): RunTallyResponseDto => {
  const runs = over.runs ?? 0;
  const failed = over.failed ?? 0;

  return {
    runs,
    cancelled: 0,
    failed,
    failedRate: runs > 0 ? failed / runs : null,
    stopped: 0,
    checksPassed: 0,
    checksFailed: 0,
    accepted: 0,
    sentBack: 0,
    passed: 0,
    merged: 0,
    cost: null,
    unpriced: 0,
    mixedCurrencies: false,
    medianMs: null,
    p90Ms: null,
    ...over,
  };
};

const TALLY_UNCHANGED: TallyDeltasResponseDto = {
  runs: NO_CHANGE,
  failed: NO_CHANGE,
  accepted: NO_CHANGE,
  sentBack: NO_CHANGE,
  merged: NO_CHANGE,
  cost: NO_CHANGE,
  median: NO_CHANGE,
};

const report = (
  stationId: string,
  now: Partial<RunTallyResponseDto>,
  over: Partial<InsightsStations['stations'][number]> = {},
) => ({
  lineId: LINE_ID,
  stationId,
  tally: tally(now),
  seen: {
    accepted: (now.accepted ?? 0) > 0,
    sentBack: (now.sentBack ?? 0) > 0,
    merged: (now.merged ?? 0) > 0,
  },
  changes: {
    ...TALLY_UNCHANGED,
    runs: (now.runs ?? 0) > 0 ? change(0.25) : NO_CHANGE,
  },
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

const STATION_REPORTS: InsightsStations['stations'] = [
  report(
    'station_triage',
    {
      runs: 58,
      failed: 2,
      passed: 55,
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
          maxInARow: 3,
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
    passed: 40,
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
      passed: 45,
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
];

const teamTrendOf = (
  reports: InsightsStations['stations'],
): InsightsStations['teamTrend'] =>
  PERIOD.days.map((day, at) => ({
    day,
    tally: tally({
      runs: reports.reduce(
        (sum, each) => sum + (each.trend[at]?.tally.runs ?? 0),
        0,
      ),
      failed: reports.reduce(
        (sum, each) => sum + (each.trend[at]?.tally.failed ?? 0),
        0,
      ),
    }),
  }));

const COUNTED = [
  'failed',
  'stopped',
  'checksPassed',
  'checksFailed',
  'accepted',
  'sentBack',
  'passed',
  'merged',
  'cancelled',
] as const;

const countedOf = (
  reports: readonly InsightsStations['stations'][number][],
): InsightsStations['teamCounted'] =>
  Object.fromEntries(
    COUNTED.map((key) => [key, reports.some((each) => each.tally[key] > 0)]),
  ) as InsightsStations['teamCounted'];

const STATIONS: InsightsStations = {
  period: PERIOD,
  team: tally({
    runs: 212,
    failed: 14,
    stopped: 3,
    checksPassed: 61,
    checksFailed: 9,
    accepted: 70,
    sentBack: 22,
    passed: 140,
    merged: 23,
    cost: { amount: 184.32, currency: 'USD' },
    medianMs: 240_000,
    p90Ms: 900_000,
  }),
  teamSeen: { accepted: true, sentBack: true, merged: true },
  teamCounted: countedOf(STATION_REPORTS),
  teamChanges: {
    runs: change(0.25),
    failed: change(null, 'bad'),
    accepted: change(null, 'good'),
    sentBack: change(null, 'bad'),
    merged: change(null, 'good'),
    cost: null,
    median: null,
  },
  teamTrend: teamTrendOf(STATION_REPORTS),
  stations: STATION_REPORTS,
};

const seedTeam = (client: QueryClient) => {
  client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);
  client.setQueryData(lineKeys.forTeam(TEAM_ID), LINES);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), INSIGHTS_HARNESSES);
};

const STATIONS_KEY = insightsStationsKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);
const seeding =
  (key: readonly unknown[], data: unknown) => (client: QueryClient) => {
    seedTeam(client);
    client.setQueryData(key, data);
  };

export const seedStations = seeding(STATIONS_KEY, STATIONS);
