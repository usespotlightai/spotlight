import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { memoryReviewKeys } from '@/hooks/api/useMemoryReview';
import type {
  MemoryReviewResponseDto,
  ProposedMemoryResponseDto,
} from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { MAYA_IMAGE } from '@/stories/fixtures/avatars';
import { HARNESSES } from '@/stories/fixtures/harnesses';

export const SLUG = 'acme';
export const TEAM_ID = 'team_platform';
export const TASK_ID = 'task_retries';

export const TASK_TITLE = 'Drain the stuck retry queues';
export const RUN_ID = 'run_retries_2';
export const MEMORIES_ITEM_ID = 'aside_retries_memories';

const DECIDED = {
  by: 'user_2',
  name: 'Maya Chen',
  at: '2026-09-15T11:40:00.000Z',
};

const MEMORIES: ProposedMemoryResponseDto[] = [
  {
    id: 'memory_billing',
    kind: 'correction',
    body: 'Leave billing-retries alone while billing is being reconciled; drain webhook-retries first.',
    source: 'person',
    origin: 'drafted',
    state: 'proposed',
    reach: 'team',
    repository: null,
    paths: [],
    supersedes: null,
    decision: null,
    harness: 'claude-code',
    steps: [],
    notes: [
      {
        position: 1,
        by: 'person',
        author: { id: 'user_2', name: 'Maya Chen', image: MAYA_IMAGE },
        text: 'Start with webhook-retries. Billing is still being reconciled, so leave it alone for now.',
      },
    ],
  },
  {
    id: 'memory_gone',
    kind: 'rationale',
    body: 'A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried.',
    source: 'run',
    origin: 'remembered',
    state: 'proposed',
    reach: 'station',
    repository: 'acme/worker',
    paths: ['src/retries/deliver.ts'],
    supersedes: null,
    decision: null,
    harness: 'claude-code',
    steps: [
      {
        index: 7,
        kind: 'remember',
        text: 'spotlight remember --kind rationale --reach station --path src/retries/deliver.ts --body "A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried."',
      },
    ],
    notes: [],
  },
  {
    id: 'memory_outside',
    kind: 'environment',
    body: 'The staging queue worker must be restarted after every deploy, or it keeps the old retry limits.',
    source: 'outside',
    origin: 'drafted',
    state: 'proposed',
    reach: 'line',
    repository: 'acme/worker',
    paths: [],
    supersedes: null,
    decision: null,
    harness: 'claude-code',
    steps: [],
    notes: [
      {
        position: 3,
        by: 'world',
        author: null,
        text: 'FYI the staging worker needs a restart after deploys or it keeps the old limits.',
      },
    ],
  },
];

const review = (
  memories: ProposedMemoryResponseDto[],
): MemoryReviewResponseDto => ({ taskId: TASK_ID, runId: RUN_ID, memories });

export const seedMemoryReview = (client: QueryClient) => {
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
  client.setQueryData(memoryReviewKeys.forRun(RUN_ID), review(MEMORIES));
};

export const seedMemoriesDecided = (client: QueryClient) =>
  client.setQueryData(
    memoryReviewKeys.forRun(RUN_ID),
    review(
      MEMORIES.map((memory, at) => ({
        ...memory,
        state: at === 2 ? 'rejected' : 'approved',
        decision: DECIDED,
        harness: 'claude-code',
      })),
    ),
  );

export const failMemoryReview = (client: QueryClient) =>
  failQuery(client, memoryReviewKeys.forRun(RUN_ID));
