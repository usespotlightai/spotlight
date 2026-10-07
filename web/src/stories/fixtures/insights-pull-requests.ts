import type { QueryClient } from '@tanstack/react-query';
import { insightsPullRequestListKeys } from '@/hooks/api/useInsightsPullRequestList';
import { insightsPullRequestsKeys } from '@/hooks/api/useInsightsPullRequests';
import { DEFAULT_PERIOD } from '@/lib/insights';
import type {
  InsightsPullRequest,
  InsightsPullRequestList,
  InsightsPullRequests,
  WeekShare,
} from '@/lib/insights-pull-requests';
import { failQuery } from '@/stories/failQuery';
import {
  daysAgo,
  loadInsights,
  PERIOD,
  spread,
} from '@/stories/fixtures/insights';
import { TEAM_ID } from '@/stories/fixtures/team';

const HOUR_MS = 3_600_000;

const MONDAYS = [
  '2026-08-31',
  '2026-09-07',
  '2026-09-14',
  '2026-09-21',
  '2026-09-28',
];

const week = (
  at: number,
  merged: number,
  made: number,
  touched: number,
  bots = 0,
): WeekShare => ({
  week: MONDAYS[at] ?? '',
  merged,
  made,
  touched,
  spotlight: made + touched,
  people: merged - made - touched - bots,
  bots,
  share: merged > 0 ? (made + touched) / merged : null,
});

const PULL_REQUESTS: InsightsPullRequests = {
  period: PERIOD,
  truncated: false,
  total: 87,
  repositories: ['acme/api', 'acme/web'],
  weeks: MONDAYS,
  penetration: {
    merged: 64,
    made: 26,
    touched: 9,
    bots: 4,
    share: 35 / 64,
    weeks: [
      week(0, 9, 2, 1, 1),
      week(1, 14, 5, 2, 1),
      week(2, 15, 6, 2, 1),
      week(3, 13, 7, 2),
      week(4, 13, 6, 2, 1),
    ],
    repositories: [
      {
        repository: 'acme/api',
        merged: 41,
        made: 20,
        touched: 6,
        bots: 3,
        share: 26 / 41,
        weeks: [
          week(0, 6, 2, 1, 1),
          week(1, 9, 4, 1),
          week(2, 9, 5, 1, 1),
          week(3, 9, 5, 2),
          week(4, 8, 4, 1, 1),
        ],
      },
      {
        repository: 'acme/web',
        merged: 23,
        made: 6,
        touched: 3,
        bots: 1,
        share: 9 / 23,
        weeks: [
          week(0, 3, 0, 0),
          week(1, 5, 1, 1, 1),
          week(2, 6, 1, 1),
          week(3, 4, 2, 0),
          week(4, 5, 2, 1),
        ],
      },
    ],
  },
  comparison: {
    repositories: ['acme/api', 'acme/web'],
    spotlight: {
      merged: 26,
      toMerge: spread(5 * HOUR_MS, 30 * HOUR_MS, 26),
      inReview: spread(2 * HOUR_MS, 9 * HOUR_MS, 24),
      meanRounds: 1.4,
      meanComments: 2.1,
      reverted: 1,
      revertRate: 1 / 26,
    },
    people: {
      merged: 29,
      toMerge: spread(9 * HOUR_MS, 52 * HOUR_MS, 29),
      inReview: spread(4 * HOUR_MS, 20 * HOUR_MS, 27),
      meanRounds: 1.8,
      meanComments: 3.4,
      reverted: 2,
      revertRate: 2 / 29,
    },
  },
  types: [
    {
      type: 'feature',
      spotlight: 11,
      people: 14,
      spend: { amount: 48.2, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
    },
    {
      type: 'fix',
      spotlight: 9,
      people: 8,
      spend: { amount: 21.75, currency: 'USD' },
      unpriced: 1,
      mixedCurrencies: false,
    },
    {
      type: 'refactor',
      spotlight: 3,
      people: 2,
      spend: { amount: 9.4, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
    },
    {
      type: 'tests',
      spotlight: 2,
      people: 1,
      spend: { amount: 3.1, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
    },
    {
      type: 'chore',
      spotlight: 1,
      people: 4,
      spend: { amount: 0.8, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
    },
    {
      type: 'other',
      spotlight: 0,
      people: 0,
      spend: null,
      unpriced: 0,
      mixedCurrencies: false,
    },
  ],
  depth: [
    { rounds: '0', spotlight: 4, people: 6 },
    { rounds: '1', spotlight: 14, people: 11 },
    { rounds: '2', spotlight: 6, people: 8 },
    { rounds: '3+', spotlight: 2, people: 4 },
  ],
};

const EMPTY_PULL_REQUESTS: InsightsPullRequests = {
  period: PERIOD,
  truncated: false,
  total: 0,
  repositories: [],
  weeks: MONDAYS,
  penetration: {
    merged: 0,
    made: 0,
    touched: 0,
    bots: 0,
    share: null,
    weeks: MONDAYS.map((_, at) => week(at, 0, 0, 0)),
    repositories: [],
  },
  comparison: {
    repositories: [],
    spotlight: {
      merged: 0,
      toMerge: spread(null, null, 0),
      inReview: spread(null, null, 0),
      meanRounds: null,
      meanComments: null,
      reverted: 0,
      revertRate: null,
    },
    people: {
      merged: 0,
      toMerge: spread(null, null, 0),
      inReview: spread(null, null, 0),
      meanRounds: null,
      meanComments: null,
      reverted: 0,
      revertRate: null,
    },
  },
  types: [],
  depth: [],
};

const pullRequest = (
  over: Partial<InsightsPullRequest> & { number: number; title: string },
): InsightsPullRequest => ({
  pullRequest: `https://github.com/${over.repository ?? 'acme/api'}/pull/${over.number}`,
  repository: 'acme/api',
  author: 'spotlight-bot[bot]',
  authorIsBot: true,
  by: 'spotlight',
  taskId: `task_${over.number}`,
  reviewTaskIds: [],
  type: 'feature',
  state: 'merged',
  openedAt: daysAgo(2, 9),
  closedAt: daysAgo(1, 15),
  firstReviewAt: daysAgo(2, 13),
  toMergeMs: 30 * HOUR_MS,
  inReviewMs: 26 * HOUR_MS,
  reviews: 1,
  reviewRounds: 1,
  reviewComments: 2,
  isRevert: false,
  reverted: false,
  revertedBy: null,
  additions: 182,
  deletions: 41,
  changedFiles: 6,
  spend: { amount: 2.4, currency: 'USD' },
  unpriced: 0,
  ...over,
});

const LIST: InsightsPullRequestList = {
  period: PERIOD,
  truncated: false,
  total: 87,
  page: 1,
  size: 50,
  pullRequests: [
    pullRequest({ number: 412, title: 'Retry failed uploads in parts' }),
    pullRequest({
      number: 409,
      title: 'Fix the session cookie on Safari',
      type: 'fix',
      repository: 'acme/web',
      reviewRounds: 3,
      reviewComments: 7,
    }),
    pullRequest({
      number: 405,
      title: 'Move billing to the new queue',
      author: 'ada',
      authorIsBot: false,
      by: 'touched',
      taskId: null,
      reviewTaskIds: ['task_review_405'],
      type: 'refactor',
      spend: null,
    }),
    pullRequest({
      number: 401,
      title: 'Bump vite from 6.1 to 6.2',
      author: 'dependabot[bot]',
      by: 'bots',
      taskId: null,
      type: 'chore',
      reviewRounds: 0,
      reviewComments: 0,
      firstReviewAt: null,
      inReviewMs: null,
      spend: null,
    }),
    pullRequest({
      number: 398,
      title: 'Add an audit log to exports',
      author: 'sam',
      authorIsBot: false,
      by: 'people',
      taskId: null,
      state: 'open',
      closedAt: null,
      toMergeMs: null,
      inReviewMs: null,
      spend: null,
    }),
  ],
};

const EMPTY_LIST: InsightsPullRequestList = {
  period: PERIOD,
  truncated: false,
  total: 0,
  page: 1,
  size: 50,
  pullRequests: [],
};

const SUMMARY_KEY = insightsPullRequestsKeys.forTeam(TEAM_ID, DEFAULT_PERIOD);

const LIST_KEY = insightsPullRequestListKeys.forTeam(
  TEAM_ID,
  DEFAULT_PERIOD,
  {},
  1,
);

export const seedPullRequests = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(SUMMARY_KEY, PULL_REQUESTS);
  client.setQueryData(LIST_KEY, LIST);
};

export const emptyPullRequests = (client: QueryClient) => {
  loadInsights(client);
  client.setQueryData(SUMMARY_KEY, EMPTY_PULL_REQUESTS);
  client.setQueryData(LIST_KEY, EMPTY_LIST);
};

export const failPullRequests = (client: QueryClient) => {
  loadInsights(client);
  failQuery(client, SUMMARY_KEY);
};
