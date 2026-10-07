import type { QueryClient } from '@tanstack/react-query';
import { insightsToolsKeys } from '@/hooks/api/useInsightsTools';
import { DEFAULT_PERIOD } from '@/lib/insights';
import type {
  InsightsTools,
  SkillReport,
  SkillWeek,
} from '@/lib/insights-tools';
import { failQuery } from '@/stories/failQuery';
import { LINE_ID, loadInsights, PERIOD } from '@/stories/fixtures/insights';
import { TEAM_ID } from '@/stories/fixtures/team';

const MONDAYS = [
  '2026-08-31',
  '2026-09-07',
  '2026-09-14',
  '2026-09-21',
  '2026-09-28',
];

const RULE = { recentWeeks: 2, fewestRuns: 5, shiftPoints: 20 };

const weeksOf = (
  uses: readonly [runs: number, given: number, used: number][],
): SkillWeek[] =>
  uses.map(([runs, given, used], at) => ({
    week: MONDAYS[at] ?? '',
    runs,
    given,
    used,
    usedShare: runs > 0 ? used / runs : null,
  }));

const skill = (over: Partial<SkillReport> & { key: string }): SkillReport => ({
  defined: true,
  given: 0,
  used: 0,
  weeks: weeksOf([]),
  trend: null,
  stations: [],
  ...over,
});

const TOOLS: InsightsTools = {
  period: PERIOD,
  truncated: false,
  weeks: MONDAYS,
  runs: 118,
  trendRule: RULE,
  skills: [
    skill({
      key: 'our-migrations',
      given: 54,
      used: 31,
      weeks: weeksOf([
        [20, 9, 2],
        [24, 11, 4],
        [26, 12, 7],
        [24, 11, 9],
        [24, 11, 9],
      ]),
      trend: 'spreading',
      stations: [
        {
          lineId: LINE_ID,
          stationId: 'station_implementation',
          runs: 61,
          given: 54,
          used: 29,
          trend: 'spreading',
        },
        {
          lineId: LINE_ID,
          stationId: 'station_review',
          runs: 32,
          given: 0,
          used: 2,
          trend: null,
        },
      ],
    }),
    skill({
      key: 'grafana-dashboards',
      given: 40,
      used: 12,
      weeks: weeksOf([
        [20, 8, 5],
        [24, 8, 4],
        [26, 8, 2],
        [24, 8, 1],
        [24, 8, 0],
      ]),
      trend: 'fading',
      stations: [
        {
          lineId: LINE_ID,
          stationId: 'station_triage',
          runs: 40,
          given: 40,
          used: 12,
          trend: 'fading',
        },
      ],
    }),
    skill({
      key: 'release-notes',
      defined: false,
      given: 0,
      used: 3,
      weeks: weeksOf([
        [20, 0, 0],
        [24, 0, 1],
        [26, 0, 0],
        [24, 0, 1],
        [24, 0, 1],
      ]),
      trend: 'steady',
      stations: [
        {
          lineId: LINE_ID,
          stationId: 'station_spec',
          runs: 17,
          given: 0,
          used: 3,
          trend: null,
        },
      ],
    }),
  ],
  unused: ['frontend-conventions', 'incident-runbook'],
  servers: [
    {
      server: 'linear',
      runs: 64,
      calls: 236,
      callsPerRun: 236 / 64,
      p50Ms: 420,
      p95Ms: 2_100,
      failedCalls: 7,
      errorRate: 7 / 236,
      failingRuns: 2,
      refused: 3,
    },
    {
      server: 'sentry',
      runs: 21,
      calls: 48,
      callsPerRun: 48 / 21,
      p50Ms: 880,
      p95Ms: 6_400,
      failedCalls: 12,
      errorRate: 12 / 48,
      failingRuns: 4,
      refused: 0,
    },
    {
      server: 'team-wiki',
      runs: 9,
      calls: 11,
      callsPerRun: 11 / 9,
      p50Ms: 150,
      p95Ms: 310,
      failedCalls: 0,
      errorRate: 0,
      failingRuns: 0,
      refused: 0,
    },
  ],
  refusals: [
    { tool: 'create_issue', server: 'linear', refused: 3 },
    { tool: 'github.merge', server: null, refused: 1 },
  ],
};

const EMPTY_TOOLS: InsightsTools = {
  period: PERIOD,
  truncated: false,
  weeks: MONDAYS,
  runs: 0,
  trendRule: RULE,
  skills: [],
  unused: [],
  servers: [],
  refusals: [],
};

const TOOLS_KEY = insightsToolsKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);

export const seedTools = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(TOOLS_KEY, TOOLS);
};

export const emptyTools = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(TOOLS_KEY, EMPTY_TOOLS);
};

export const failTools = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, TOOLS_KEY);
};
