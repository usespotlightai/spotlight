import type { QueryClient } from '@tanstack/react-query';
import { insightsChangesKeys } from '@/hooks/api/useInsightsChanges';
import { insightsSetupsKeys } from '@/hooks/api/useInsightsSetups';
import { DEFAULT_PERIOD } from '@/lib/insights';
import type {
  ChangeMarker,
  InsightsChanges,
  InsightsSetups,
  SetupOutcome,
} from '@/lib/insights-changes';
import { failQuery } from '@/stories/failQuery';
import {
  daysAgo,
  LINE_ID,
  loadInsights,
  measured,
  PERIOD,
  tally,
} from '@/stories/fixtures/insights';
import { TEAM_ID } from '@/stories/fixtures/team';

const usd = (amount: number) => ({ amount, currency: 'USD' });

export const OPUS_CHANGE: ChangeMarker = {
  lineId: LINE_ID,
  stationId: 'station_implementation',
  fingerprint: 'b'.repeat(64),
  previousFingerprint: 'a'.repeat(64),
  firstRunAt: daysAgo(12, 9),
  runId: 'run_impl_40',
  before: tally({
    runs: 38,
    failed: 4,
    checksPassed: 22,
    checksFailed: 9,
    accepted: 14,
    sentBack: 11,
    handedOn: 12,
    merged: 9,
    cost: usd(19.4),
    unpriced: 2,
    medianMs: 410_000,
  }),
  after: tally({
    runs: 41,
    failed: 2,
    checksPassed: 31,
    checksFailed: 4,
    accepted: 22,
    sentBack: 5,
    handedOn: 15,
    merged: 14,
    cost: usd(35.6),
    medianMs: 520_000,
  }),
  verdicts: [
    measured('sent_back_rate', 0.44, 0.19, 'better', { before: 25, after: 27 }),
    measured('accepted_rate', 0.56, 0.81, 'better', { before: 25, after: 27 }),
    measured('checks_failed_rate', 0.29, 0.11, 'better', {
      before: 31,
      after: 35,
    }),
    measured('failed_rate', 0.11, 0.05, 'better', { before: 38, after: 41 }),
    measured('merged_rate', 0.6, 0.78, 'better', { before: 15, after: 18 }),
    measured('cost_per_run', 0.54, 0.87, 'worse', { before: 36, after: 41 }),
  ],
  judgeBefore: { mean: 0.58, judged: 9 },
  judgeAfter: { mean: 0.74, judged: 11 },
  changes: [
    { part: 'model', name: null, kind: 'changed', was: 'sonnet', now: 'opus' },
    {
      part: 'skill',
      name: 'our-migrations',
      kind: 'added',
      was: null,
      now: 'our-migrations',
    },
  ],
};

const REVIEW_CHANGE: ChangeMarker = {
  lineId: LINE_ID,
  stationId: 'station_review',
  fingerprint: 'd'.repeat(64),
  previousFingerprint: 'c'.repeat(64),
  firstRunAt: daysAgo(4, 15),
  runId: 'run_review_20',
  before: tally({
    runs: 20,
    accepted: 15,
    sentBack: 3,
    cost: usd(4.1),
    medianMs: 95_000,
  }),
  after: tally({
    runs: 7,
    accepted: 4,
    sentBack: 2,
    cost: usd(1.6),
    medianMs: 80_000,
  }),
  verdicts: [
    measured('sent_back_rate', 0.17, 0.33, 'worse', { before: 18, after: 6 }),
    measured('accepted_rate', 0.83, 0.67, 'worse', { before: 18, after: 6 }),
    measured('checks_failed_rate', null, null, 'insufficient', {
      before: 0,
      after: 0,
    }),
    measured('failed_rate', 0, 0, 'unchanged', { before: 20, after: 7 }),
    measured('merged_rate', null, null, 'insufficient', {
      before: 0,
      after: 0,
    }),
    measured('cost_per_run', 0.21, 0.23, 'insufficient', {
      before: 20,
      after: 4,
    }),
  ],
  judgeBefore: null,
  judgeAfter: null,
  changes: [
    {
      part: 'prompt',
      name: null,
      kind: 'changed',
      was: 'Review the change.',
      now: 'Review the change against the spec.',
    },
  ],
};

const CHANGES: InsightsChanges = {
  period: PERIOD,
  truncated: false,
  markers: [OPUS_CHANGE, REVIEW_CHANGE],
  judges: [
    {
      lineId: LINE_ID,
      stationId: 'station_implementation',
      trusted: true,
      measure: 'kappa',
      agreement: 0.72,
      pairs: 24,
      trust: 0.6,
      hiddenBecause: null,
    },
    {
      lineId: LINE_ID,
      stationId: 'station_review',
      trusted: false,
      measure: 'spearman',
      agreement: 0.31,
      pairs: 14,
      trust: 0.6,
      hiddenBecause: 'below-trust',
    },
  ],
};

const EMPTY_CHANGES: InsightsChanges = {
  period: PERIOD,
  truncated: false,
  markers: [],
  judges: [],
};

const setup = (
  over: Partial<SetupOutcome> & Pick<SetupOutcome, 'model' | 'costPerRun'>,
): SetupOutcome => ({
  harness: 'claude-code',
  effort: null,
  profileKey: null,
  tally: tally({ runs: 20 }),
  currency: 'USD',
  outcomes: {
    accepted: 0.5,
    sent_back: 0.2,
    handed_on: 0.3,
    checks_passed: 0.8,
    merged: 0.4,
    judge: null,
  },
  judge: { mean: null, judged: 0 },
  frontier: [],
  ...over,
});

const SETUPS_AT_STATION: InsightsSetups = {
  period: PERIOD,
  truncated: false,
  stationId: 'station_implementation',
  size: null,
  sizes: [
    { size: 'small', mostLines: 50, mostSteps: 20 },
    { size: 'medium', mostLines: 400, mostSteps: 80 },
    { size: 'large', mostLines: null, mostSteps: null },
  ],
  fewestRuns: 3,
  currency: 'USD',
  setups: [
    setup({
      model: 'sonnet',
      costPerRun: 0.42,
      tally: tally({ runs: 96 }),
      outcomes: {
        accepted: 0.48,
        sent_back: 0.24,
        handed_on: 0.31,
        checks_passed: 0.74,
        merged: 0.36,
        judge: 0.61,
      },
      judge: { mean: 0.61, judged: 18 },
      frontier: ['accepted', 'sent_back', 'merged'],
    }),
    setup({
      model: 'opus',
      effort: 'high',
      costPerRun: 0.87,
      tally: tally({ runs: 41 }),
      outcomes: {
        accepted: 0.54,
        sent_back: 0.12,
        handed_on: 0.37,
        checks_passed: 0.89,
        merged: 0.34,
        judge: 0.74,
      },
      judge: { mean: 0.74, judged: 11 },
      frontier: [
        'accepted',
        'sent_back',
        'handed_on',
        'checks_passed',
        'judge',
      ],
    }),
    setup({
      model: 'opus',
      effort: 'low',
      costPerRun: 0.95,
      tally: tally({ runs: 22 }),
      outcomes: {
        accepted: 0.41,
        sent_back: 0.27,
        handed_on: 0.29,
        checks_passed: 0.7,
        merged: 0.27,
        judge: null,
      },
    }),
    setup({
      model: 'haiku',
      costPerRun: 0.11,
      tally: tally({ runs: 31 }),
      outcomes: {
        accepted: 0.23,
        sent_back: 0.39,
        handed_on: 0.18,
        checks_passed: 0.52,
        merged: 0.16,
        judge: 0.32,
      },
      judge: { mean: 0.32, judged: 6 },
      frontier: ['accepted', 'handed_on', 'checks_passed', 'merged', 'judge'],
    }),
    setup({
      harness: 'cursor',
      model: null,
      profileKey: 'careful',
      costPerRun: null,
      currency: null,
      tally: tally({ runs: 2 }),
    }),
  ],
  judgeWithheld: null,
  judges: CHANGES.judges.slice(0, 1),
};

const SETUPS: InsightsSetups = {
  ...SETUPS_AT_STATION,
  stationId: null,
  judgeWithheld: 'no_station',
  judges: [],
  setups: SETUPS_AT_STATION.setups.map((each) => ({
    ...each,
    judge: null,
    outcomes: { ...each.outcomes, judge: null },
    frontier: each.frontier.filter((measure) => measure !== 'judge'),
  })),
};

const EMPTY_SETUPS: InsightsSetups = { ...SETUPS, setups: [], judges: [] };

const CHANGES_KEY = insightsChangesKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);

const SETUPS_KEY = insightsSetupsKeys.forTeam(TEAM_ID, DEFAULT_PERIOD, {
  stationId: null,
  size: null,
});

const SETUPS_AT_STATION_KEY = insightsSetupsKeys.forTeam(
  TEAM_ID,
  DEFAULT_PERIOD,
  { stationId: 'station_implementation', size: null },
);

export const seedChanges = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(CHANGES_KEY, CHANGES);
  client.setQueryData(SETUPS_KEY, SETUPS);
  client.setQueryData(SETUPS_AT_STATION_KEY, SETUPS_AT_STATION);
};

export const emptyChanges = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(CHANGES_KEY, EMPTY_CHANGES);
  client.setQueryData(SETUPS_KEY, EMPTY_SETUPS);
};

export const failChanges = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, CHANGES_KEY);
  client.setQueryData(SETUPS_KEY, SETUPS);
};

export const seedBeforeAfter = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(CHANGES_KEY, CHANGES);
};

export const goneBeforeAfter = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(CHANGES_KEY, EMPTY_CHANGES);
};

export const failBeforeAfter = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, CHANGES_KEY);
};
