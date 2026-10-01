import type { QueryClient } from '@tanstack/react-query';
import { insightsMemoryKeys } from '@/hooks/api/useInsightsMemory';
import { DEFAULT_PERIOD } from '@/lib/insights';
import type { InsightsMemory } from '@/lib/insights-memory';
import { failQuery } from '@/stories/failQuery';
import {
  daysAgo,
  loadInsights,
  measured,
  PERIOD,
  tally,
} from '@/stories/fixtures/insights';
import { TEAM_ID } from '@/stories/fixtures/team';

const MEMORY: InsightsMemory = {
  period: PERIOD,
  truncated: false,
  standing: 24,
  memoriesBriefed: 17,
  memoriesRecalled: 6,
  runsBriefed: 88,
  runsRecalled: 19,
  flagged: [
    {
      memoryId: 'memory_12',
      handle: 'M-12',
      body: 'Run the migrations before the integration tests.',
      reason: 'The test setup runs them itself since August.',
      by: 'user_2',
      byName: 'Ada Lovelace',
      at: daysAgo(6),
    },
    {
      memoryId: 'memory_31',
      handle: 'M-31',
      body: 'Billing uses cents everywhere.',
      reason: null,
      by: 'user_9',
      byName: null,
      at: daysAgo(15),
    },
  ],
  withMemories: tally({
    runs: 96,
    accepted: 54,
    sentBack: 14,
    handedOn: 33,
    checksPassed: 71,
    checksFailed: 9,
    merged: 31,
    cost: { amount: 52.3, currency: 'USD' },
    medianMs: 380_000,
  }),
  withoutMemories: tally({
    runs: 116,
    accepted: 49,
    sentBack: 28,
    handedOn: 35,
    checksPassed: 70,
    checksFailed: 21,
    merged: 27,
    cost: { amount: 61.9, currency: 'USD' },
    medianMs: 410_000,
  }),
  verdicts: [
    measured('sent_back_rate', 0.36, 0.21, 'better', { before: 77, after: 68 }),
    measured('accepted_rate', 0.64, 0.79, 'better', { before: 77, after: 68 }),
    measured('checks_failed_rate', 0.23, 0.11, 'better', {
      before: 91,
      after: 80,
    }),
    measured('failed_rate', 0.08, 0.08, 'unchanged', {
      before: 116,
      after: 96,
    }),
    measured('merged_rate', 0.55, 0.62, 'better', { before: 49, after: 50 }),
    measured('cost_per_run', 0.53, 0.54, 'worse', { before: 116, after: 96 }),
  ],
  benchmark: null,
};

const EMPTY_MEMORY: InsightsMemory = {
  ...MEMORY,
  standing: 0,
  memoriesBriefed: 0,
  memoriesRecalled: 0,
  runsBriefed: 0,
  runsRecalled: 0,
  flagged: [],
  withMemories: tally({}),
  withoutMemories: tally({ runs: 40 }),
  verdicts: MEMORY.verdicts.map((each) => ({
    ...each,
    after: null,
    settledAfter: 0,
    verdict: 'insufficient' as const,
  })),
};

const MEMORY_KEY = insightsMemoryKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);

export const seedMemory = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(MEMORY_KEY, MEMORY);
};

export const seedBenchmarkedMemory = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(MEMORY_KEY, {
    ...MEMORY,
    benchmark: {
      ranAt: daysAgo(2),
      withMemories: 0.8,
      withoutMemories: 0.65,
      cases: 20,
    },
  });
};

export const emptyMemory = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(MEMORY_KEY, EMPTY_MEMORY);
};

export const failMemory = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, MEMORY_KEY);
};
