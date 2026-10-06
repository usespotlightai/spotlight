import type { QueryClient } from '@tanstack/react-query';
import { insightsCandidatesKeys } from '@/hooks/api/useInsightsCandidates';
import { DEFAULT_PERIOD } from '@/lib/insights';
import type {
  CandidatesSet,
  InsightsCandidates,
  SetCandidate,
} from '@/lib/insights-candidates';
import { failQuery } from '@/stories/failQuery';
import {
  daysAgo,
  LINE_ID,
  loadInsights,
  PERIOD,
} from '@/stories/fixtures/insights';
import { TEAM_ID } from '@/stories/fixtures/team';

const candidate = (
  over: Partial<SetCandidate> &
    Pick<SetCandidate, 'candidateId' | 'name' | 'kind' | 'replayId'>,
): SetCandidate => ({
  hypothesis: null,
  fingerprint: 'e'.repeat(64),
  changes: [],
  replayState: 'finished',
  replayedAt: daysAgo(4),
  tasks: 18,
  runs: 18,
  successRate: null,
  interval: null,
  intervalOnCompared: null,
  scored: 18,
  heldOut: null,
  costPerRun: null,
  currency: 'USD',
  live: null,
  successRateOnCompared: null,
  costPerRunOnCompared: null,
  regressions: null,
  compared: 0,
  againstLive: null,
  onFrontier: null,
  search: null,
  pullRequest: null,
  ...over,
});

const SEARCH = {
  searchId: 'search_1',
  objective: 'success' as const,
  state: 'finished' as const,
  startedAt: daysAgo(5),
  seed: { successRate: 0.55, interval: null, costPerRun: 0.6, scored: 18 },
};

const IMPLEMENTATION_SET: CandidatesSet = {
  setId: 'set_implementation',
  name: 'Migrations and billing',
  stationGone: false,
  guardsChanges: true,
  health: {
    tasks: 24,
    runs: 27,
    oldestRunEndedAt: daysAgo(41),
    newestRunEndedAt: daysAgo(3),
    lastAddedAt: daysAgo(2),
    noise: {
      replayId: 'replay_live_impl_noise',
      fingerprint: 'b'.repeat(64),
      repeats: 3,
      perRepeat: [0.5, 0.58, 0.63],
      spread: 0.13,
      flippedTasks: ['task_3', 'task_9', 'task_14'],
      measuredAt: daysAgo(4),
    },
    saturation: {
      replayId: 'replay_live_impl_noise',
      rate: 0.57,
      interval: { rate: 0.57, low: 0.38, high: 0.75 },
      saturated: false,
      measuredAt: daysAgo(4),
    },
    judge: {
      replayId: 'replay_live_impl_noise',
      compared: 20,
      agreed: 14,
      pending: 0,
      agreement: 0.7,
      unstable: true,
    },
    checks: {
      replayId: 'replay_live_impl_noise',
      rechecked: 18,
      pending: 0,
      flaky: [],
    },
    sanity: null,
    minGain: 0.05,
  },
  baseline: {
    replayId: 'replay_live_impl',
    state: 'finished',
    fingerprint: 'b'.repeat(64),
    scored: 24,
    successRate: 0.54,
    interval: { rate: 0.54, low: 0.35, high: 0.73 },
    costPerRun: 0.62,
    currency: 'USD',
    endedAt: daysAgo(6),
  },
  candidates: [
    candidate({
      candidateId: 'candidate_opus_skill',
      name: 'opus-with-migrations-skill',
      kind: 'searched',
      replayId: 'replay_opus_skill',
      tasks: 16,
      runs: 18,
      hypothesis:
        'Sent-back runs mostly forgot the migration order; the skill spells it out, and opus follows long skills better.',
      changes: [
        {
          part: 'model',
          name: null,
          kind: 'changed',
          was: 'sonnet',
          now: 'opus',
        },
        {
          part: 'skill',
          name: 'our-migrations',
          kind: 'added',
          was: null,
          now: 'our-migrations',
        },
      ],
      successRate: 0.72,
      interval: { rate: 0.72, low: 0.5, high: 0.89 },
      costPerRun: 0.84,
      heldOut: {
        replayId: 'replay_opus_skill_held_out',
        state: 'finished',
        score: 0.67,
        interval: { rate: 0.67, low: 0.33, high: 1 },
        tasks: 6,
        runs: 7,
      },
      live: {
        successRate: 0.56,
        interval: { rate: 0.56, low: 0.36, high: 0.74 },
        costPerRun: 0.6,
        currency: 'USD',
      },
      successRateOnCompared: 0.72,
      intervalOnCompared: { rate: 0.72, low: 0.52, high: 0.9 },
      costPerRunOnCompared: 0.82,
      regressions: 1,
      compared: 18,
      againstLive: {
        gain: 0.16,
        low: 0.02,
        high: 0.3,
        verdict: 'better',
        minGain: 0.05,
        tasks: 16,
      },
      onFrontier: true,
      search: SEARCH,
      pullRequest: {
        id: 'config_pull_request_1',
        state: 'opened',
        url: 'https://github.com/acme/spotlight-config/pull/42',
        reason: null,
      },
    }),
    candidate({
      candidateId: 'candidate_terse',
      name: 'sonnet-terse-prompt',
      kind: 'searched',
      replayId: 'replay_terse',
      hypothesis: 'A shorter prompt leaves more room for the diff.',
      changes: [
        {
          part: 'prompt',
          name: null,
          kind: 'changed',
          was: null,
          now: null,
        },
      ],
      successRate: 0.5,
      interval: { rate: 0.5, low: 0.28, high: 0.72 },
      costPerRun: 0.38,
      heldOut: null,
      live: {
        successRate: 0.56,
        interval: { rate: 0.56, low: 0.36, high: 0.74 },
        costPerRun: 0.6,
        currency: 'USD',
      },
      successRateOnCompared: 0.5,
      intervalOnCompared: { rate: 0.5, low: 0.3, high: 0.68 },
      regressions: 3,
      compared: 18,
      againstLive: {
        gain: -0.06,
        low: -0.22,
        high: 0.1,
        verdict: 'within-noise',
        minGain: 0.05,
        tasks: 16,
      },
      onFrontier: true,
      search: SEARCH,
    }),
    candidate({
      candidateId: 'candidate_cursor',
      name: 'cursor-careful-profile',
      kind: 'searched',
      replayId: 'replay_cursor',
      changes: [
        {
          part: 'harness',
          name: null,
          kind: 'changed',
          was: 'claude-code',
          now: 'cursor',
        },
      ],
      successRate: 0.61,
      interval: null,
      costPerRun: null,
      live: {
        successRate: 0.56,
        interval: { rate: 0.56, low: 0.36, high: 0.74 },
        costPerRun: 0.6,
        currency: 'USD',
      },
      successRateOnCompared: 0.61,
      intervalOnCompared: { rate: 0.61, low: 0.41, high: 0.79 },
      regressions: 2,
      compared: 18,
      onFrontier: false,
      search: SEARCH,
    }),
    candidate({
      candidateId: 'candidate_plan_first',
      name: 'sonnet-plan-first',
      kind: 'searched',
      replayId: 'replay_plan_first',
      replayState: 'running',
      successRate: 0.4,
      interval: null,
      scored: 5,
      costPerRun: 0.3,
      onFrontier: false,
      search: SEARCH,
    }),
  ],
};

const REVIEW_SET: CandidatesSet = {
  setId: 'set_review',
  name: 'Reviews sent back',
  stationGone: false,
  guardsChanges: false,
  health: {
    tasks: 12,
    runs: 12,
    oldestRunEndedAt: daysAgo(20),
    newestRunEndedAt: daysAgo(8),
    lastAddedAt: daysAgo(8),
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
    minGain: 0.05,
  },
  baseline: {
    replayId: 'replay_live_review',
    state: 'finished',
    fingerprint: 'd'.repeat(64),
    scored: 12,
    successRate: 0.75,
    interval: null,
    costPerRun: 0.21,
    currency: 'USD',
    endedAt: daysAgo(9),
  },
  candidates: [
    candidate({
      candidateId: 'candidate_spec_review',
      name: 'review-against-spec',
      kind: 'proposed',
      replayId: 'replay_spec_review',
      tasks: 12,
      scored: 12,
      changes: [
        {
          part: 'prompt',
          name: null,
          kind: 'changed',
          was: null,
          now: null,
        },
      ],
      successRate: 0.67,
      interval: null,
      costPerRun: 0.24,
      live: {
        successRate: 0.75,
        interval: { rate: 0.75, low: 0.55, high: 0.93 },
        costPerRun: 0.21,
        currency: 'USD',
      },
      successRateOnCompared: 0.67,
      intervalOnCompared: { rate: 0.67, low: 0.47, high: 0.85 },
      costPerRunOnCompared: 0.24,
      regressions: 2,
      compared: 12,
      againstLive: {
        gain: -0.08,
        low: -0.25,
        high: 0.08,
        verdict: 'within-noise',
        minGain: 0.05,
        tasks: 12,
      },
    }),
    candidate({
      candidateId: 'candidate_one_comment',
      name: 'one-comment-per-problem',
      kind: 'proposed',
      replayId: 'replay_one_comment',
      fingerprint: 'd'.repeat(64),
      replayedAt: daysAgo(6),
      tasks: 12,
      runs: 12,
      scored: 12,
      successRate: 0.75,
      costPerRun: 0.21,
      live: {
        successRate: 0.75,
        interval: { rate: 0.75, low: 0.55, high: 0.93 },
        costPerRun: 0.21,
        currency: 'USD',
      },
      successRateOnCompared: 0.75,
      intervalOnCompared: { rate: 0.75, low: 0.55, high: 0.93 },
      costPerRunOnCompared: 0.21,
      regressions: 0,
      compared: 12,
      againstLive: {
        gain: 0,
        low: -0.08,
        high: 0.08,
        verdict: 'within-noise',
        minGain: 0.05,
        tasks: 12,
      },
    }),
  ],
};

export const CANDIDATES: InsightsCandidates = {
  period: { name: PERIOD.name, from: PERIOD.from, to: PERIOD.to },
  truncated: false,
  stations: [
    {
      lineId: LINE_ID,
      stationId: 'station_implementation',
      sets: [IMPLEMENTATION_SET],
    },
    { lineId: LINE_ID, stationId: 'station_review', sets: [REVIEW_SET] },
  ],
};

const EMPTY_CANDIDATES: InsightsCandidates = { ...CANDIDATES, stations: [] };

export const CANDIDATES_KEY = insightsCandidatesKeys.forTeam(
  TEAM_ID,
  DEFAULT_PERIOD,
);

export const seedCandidates = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(CANDIDATES_KEY, CANDIDATES);
};

export const emptyCandidates = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(CANDIDATES_KEY, EMPTY_CANDIDATES);
};

export const failCandidates = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, CANDIDATES_KEY);
};
