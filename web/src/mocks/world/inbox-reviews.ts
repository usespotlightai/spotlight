import type {
  CodeReviewResponseDto,
  ReviewCommentResponseDto,
  TaskDecisionsResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { minutesAfter, runEnded } from '@/mocks/world/inbox-places';
import { MAYA, SAM } from '@/mocks/world/people';
import {
  PAID_AT_MIGRATION,
  PULL_412,
  PULL_431,
  stepIndexOf,
  TRIGRAM_MIGRATION,
} from '@/mocks/world/work-stories';

const MIGRATION_PATH = PAID_AT_MIGRATION;
const POSTGRES_RUN = 'run_postgres_2';
const SEARCH_RUN = 'run_search_2';

const stepsOf = (runId: string, ...texts: string[]): number[] =>
  texts.map((text) => stepIndexOf(runId, text));

const comment = (
  over: Partial<ReviewCommentResponseDto> &
    Pick<ReviewCommentResponseDto, 'id' | 'path' | 'body' | 'createdAt'>,
): ReviewCommentResponseDto => ({
  side: 'new',
  line: null,
  startLine: null,
  authorName: 'Spotlight',
  authorLogin: null,
  authorImage: null,
  yours: false,
  byAgent: false,
  replyTo: null,
  state: 'posted',
  failure: null,
  url: null,
  editedAt: null,
  ...over,
});

export const seedCodeReviews = (): Record<string, CodeReviewResponseDto> => {
  const reviewed = runEnded('run_postgres_3');

  return {
    run_postgres_2: {
      pullRequest: PULL_431,
      comments: [
        comment({
          id: 'comment_batching',
          path: MIGRATION_PATH,
          line: 3,
          startLine: 2,
          byAgent: true,
          body: 'This rewrites all 1.3M rows of `invoices` in one statement and holds its lock for about 40 seconds. Run it in batches from a backfill job instead?',
          url: `${PULL_431}#discussion_r1981204`,
          createdAt: minutesAfter(reviewed, -2),
        }),
        comment({
          id: 'comment_batching_reply',
          path: MIGRATION_PATH,
          line: 3,
          startLine: 2,
          authorName: MAYA.name,
          authorLogin: 'mayachen',
          replyTo: 'comment_batching',
          body: 'Agreed, batches of 50k. The deploy cannot wait 40 seconds on invoices.',
          url: `${PULL_431}#discussion_r1981377`,
          createdAt: hoursAgo(6),
        }),
        comment({
          id: 'comment_pool_timeout',
          path: 'src/db/pool.ts',
          line: 7,
          authorName: SAM.name,
          yours: true,
          state: 'draft',
          body: 'Should `idleTimeoutMillis` stay at 10s now that the job runner shares this pool?',
          createdAt: hoursAgo(1),
        }),
      ],
      reviews: [
        {
          id: 'review_code_review_station',
          authorName: 'Spotlight',
          yours: false,
          byAgent: true,
          verdict: 'comment',
          body: 'Safe to merge once the migration runs in batches. Dropping the native binding is fine for our query sizes.',
          state: 'posted',
          failure: null,
          submittedAt: reviewed,
        },
      ],
    },
    run_search_2: {
      pullRequest: PULL_412,
      comments: [],
      reviews: [
        {
          id: 'review_search_sam',
          authorName: SAM.name,
          yours: true,
          byAgent: false,
          verdict: 'approve',
          body: 'Lovely speed-up. Merging.',
          state: 'posted',
          failure: null,
          submittedAt: minutesAfter(runEnded('run_search_3'), 30),
        },
      ],
    },
  };
};

export const seedDecisions = (): Record<string, TaskDecisionsResponseDto> => ({
  task_postgres: {
    runId: POSTGRES_RUN,
    drafting: false,
    standing: 'proposed',
    merge: null,
    decisions: [
      {
        id: 'decision_one_statement',
        kind: 'deviation',
        title:
          'The migration rewrites `invoices.paid_at` in one statement, not in batches',
        why: 'The spec says nothing on batching. One statement is simplest and took 40 seconds on a copy of production, holding a lock on invoices the whole time.',
        alternatives: ['Rewrite in batches of 50,000 from a backfill job'],
        paths: [MIGRATION_PATH],
        steps: stepsOf(POSTGRES_RUN, MIGRATION_PATH),
        disputes: [],
      },
      {
        id: 'decision_old_precision',
        kind: 'limitation',
        title:
          'Timestamps written before the upgrade keep millisecond precision',
        why: 'The migration widens the column but cannot recover microseconds that were never stored.',
        alternatives: [],
        paths: ['src/db/timestamps.ts', MIGRATION_PATH],
        steps: stepsOf(POSTGRES_RUN, 'src/db/timestamps.ts'),
        disputes: [],
      },
      {
        id: 'decision_drop_native',
        kind: 'trade-off',
        title: 'Dropped the `pg-native` binding',
        why: 'pg 8.13 in plain JavaScript is as fast for our query sizes, and the binding broke the Alpine image build.',
        alternatives: ['Keep pg-native and pin libpq in the image'],
        paths: ['package.json', 'src/db/pool.ts'],
        steps: stepsOf(
          POSTGRES_RUN,
          'npm uninstall pg-native && npm install pg@8.13.1',
          'package.json',
          'src/db/pool.ts',
        ),
        disputes: [
          {
            id: 'dispute_reporting_replica',
            path: 'src/db/pool.ts',
            by: MAYA.id,
            byName: MAYA.name,
            reason:
              'The reporting replica still runs pg-native for its big exports. Check with data before we drop it there too.',
            at: hoursAgo(5),
          },
        ],
      },
    ],
  },
  task_search: {
    runId: SEARCH_RUN,
    drafting: false,
    standing: 'stands',
    merge: {
      repository: 'acme/api',
      commit: '8f3c2a1d4b6e9f0a7c5d3e1b2a4f6c8d0e9b7a51',
      at: minutesAfter(runEnded('run_search_3'), 35),
    },
    decisions: [
      {
        id: 'decision_trigram',
        kind: 'trade-off',
        title: 'Search uses a trigram index rather than full-text search',
        why: 'Task titles are short and people type fragments of them, which full-text search ranks poorly.',
        alternatives: ['Postgres full-text search with a tsvector column'],
        paths: [TRIGRAM_MIGRATION, 'src/search/workspace-search.ts'],
        steps: stepsOf(SEARCH_RUN, TRIGRAM_MIGRATION),
        disputes: [],
      },
    ],
  },
  task_retries: {
    runId: null,
    drafting: true,
    standing: 'proposed',
    merge: null,
    decisions: [],
  },
});

export const noDecisions = (): TaskDecisionsResponseDto => ({
  runId: null,
  drafting: false,
  standing: 'proposed',
  merge: null,
  decisions: [],
});
