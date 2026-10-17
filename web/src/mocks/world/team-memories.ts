import type {
  MemoryGroundNoteResponseDto,
  MemoryPersonResponseDto,
  TeamMemoryDetailResponseDto,
} from '@/lib/api';
import { daysAgo, hoursAgo } from '@/mocks/clock';
import {
  DELIVERY_ID,
  EXPERIMENTS_ID,
  GROWTH_ID,
  INCIDENTS_ID,
  PLATFORM_ID,
  perWorld,
} from '@/mocks/world';
import { minutesAfter, runEnded } from '@/mocks/world/inbox-places';
import { MAYA, PRIYA, SAM, TOM } from '@/mocks/world/people';
import {
  DISK_DUMPS_MESSAGE,
  DRAIN_ANSWER,
  GONE_REMEMBER,
  GONE_THOUGHT,
  groundStep,
  PAID_AT_MIGRATION,
  PRICING_FLAG_MESSAGE,
  SEARCH_SCAN_THOUGHT,
} from '@/mocks/world/work-stories';

const DRAIN_APPROVED = () => minutesAfter(runEnded('run_retries_2'), 20);

export type MemoryRecord = Omit<
  TeamMemoryDetailResponseDto,
  'superseded' | 'successor'
>;

const person = ({ id, name, image }: MemoryPersonResponseDto) => ({
  id,
  name,
  image,
});

const personNote = (
  position: number,
  author: MemoryPersonResponseDto,
  text: string,
): MemoryGroundNoteResponseDto => ({
  position,
  by: 'person',
  author: person(author),
  text,
});

const fromAnotherTool = (
  position: number,
  text: string,
): MemoryGroundNoteResponseDto => ({
  position,
  by: 'world',
  author: null,
  text,
});

const memory = (
  over: Partial<MemoryRecord> &
    Pick<MemoryRecord, 'id' | 'handle' | 'kind' | 'body' | 'approvedAt'>,
): MemoryRecord => {
  const reach = over.stationId ? 'station' : over.lineId ? 'line' : 'team';

  return {
    source: 'person',
    status: 'active',
    reach,
    lineId: null,
    stationId: null,
    repository: null,
    paths: [],
    approvedBy: person(SAM),
    supersedes: null,
    retirement: null,
    grounds: null,
    runs: 0,
    harness: null,
    steps: [],
    notes: [],
    ...over,
  };
};

const PLATFORM_MEMORIES: MemoryRecord[] = [
  memory({
    id: 'memory_billing',
    handle: 'M-41',
    kind: 'correction',
    body: 'Leave billing-retries alone while billing is being reconciled; drain webhook-retries first.',
    approvedBy: person(MAYA),
    approvedAt: DRAIN_APPROVED(),
    grounds: { taskId: 'task_retries', runId: 'run_retries_2' },
    runs: 2,
    harness: 'claude-code',
    notes: [personNote(1, MAYA, DRAIN_ANSWER)],
  }),
  memory({
    id: 'memory_gone',
    handle: 'M-42',
    kind: 'rationale',
    source: 'run',
    lineId: DELIVERY_ID,
    stationId: 'station_implementation',
    repository: 'acme/worker',
    paths: ['src/retries/deliver.ts'],
    body: 'A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried.',
    approvedBy: person(MAYA),
    approvedAt: DRAIN_APPROVED(),
    grounds: { taskId: 'task_retries', runId: 'run_retries_2' },
    runs: 1,
    harness: 'claude-code',
    steps: [
      groundStep('run_retries_2', GONE_THOUGHT),
      groundStep('run_retries_2', GONE_REMEMBER, 'remember'),
    ],
  }),
  memory({
    id: 'memory_staging',
    handle: 'M-43',
    kind: 'environment',
    source: 'outside',
    lineId: DELIVERY_ID,
    repository: 'acme/worker',
    body: 'The staging queue worker must be restarted after every deploy, or it keeps the old retry limits.',
    approvedAt: hoursAgo(5),
    grounds: { taskId: 'task_retries', runId: 'run_retries_1' },
    runs: 3,
    harness: 'claude-code',
    notes: [
      fromAnotherTool(
        3,
        'FYI the staging worker needs a restart after deploys or it keeps the old limits.',
      ),
    ],
  }),
  memory({
    id: 'memory_precision',
    handle: 'M-46',
    kind: 'failure',
    source: 'run',
    lineId: DELIVERY_ID,
    stationId: 'station_implementation',
    repository: 'acme/api',
    paths: ['src/db/timestamps.ts', PAID_AT_MIGRATION],
    body: 'pg 8.13 returns timestamptz values with microseconds; tests that compare paid_at as strings fail until the API cuts timestamps to milliseconds.',
    approvedBy: person(MAYA),
    approvedAt: hoursAgo(28),
    grounds: { taskId: 'task_postgres', runId: 'run_postgres_2' },
    runs: 5,
    harness: 'claude-code',
    steps: [
      groundStep('run_postgres_2', 'npm test'),
      groundStep('run_postgres_2', 'src/db/timestamps.ts'),
    ],
  }),
  memory({
    id: 'memory_small_prs',
    handle: 'M-47',
    kind: 'preference',
    lineId: DELIVERY_ID,
    body: 'Keep pull requests under 400 changed lines, and put database migrations in a pull request of their own.',
    approvedBy: person(TOM),
    approvedAt: daysAgo(9),
    runs: 23,
  }),
  memory({
    id: 'memory_crash_dumps',
    handle: 'M-48',
    kind: 'environment',
    source: 'run',
    lineId: INCIDENTS_ID,
    stationId: 'station_investigate',
    repository: 'acme/infra',
    paths: ['terraform/workers/eu-west-1.tf'],
    body: 'Workers in eu-west-1 write core dumps to /var/crash; clear them before resizing a disk, or the resize fills up again within a day.',
    approvedBy: person(TOM),
    approvedAt: hoursAgo(77),
    grounds: { taskId: 'task_disk', runId: 'run_disk_1' },
    runs: 1,
    harness: 'claude-code',
    steps: [groundStep('run_disk_1', DISK_DUMPS_MESSAGE)],
  }),
  memory({
    id: 'memory_search_index',
    handle: 'M-39',
    kind: 'rejected-approach',
    source: 'run',
    lineId: DELIVERY_ID,
    stationId: 'station_implementation',
    repository: 'acme/api',
    paths: ['src/search/workspace-search.ts'],
    body: 'Searching task titles with ILIKE and a leading wildcard scans the whole table, 1.8 seconds on the largest workspace; search them through the trigram index instead.',
    approvedBy: person(SAM),
    approvedAt: daysAgo(16),
    grounds: { taskId: 'task_search', runId: 'run_search_2' },
    runs: 7,
    harness: 'claude-code',
    steps: [groundStep('run_search_2', SEARCH_SCAN_THOUGHT)],
  }),
  memory({
    id: 'memory_branches_ticket',
    handle: 'M-40',
    kind: 'preference',
    body: 'Name branches after the ticket number, as in spo-142-retry-backoff.',
    approvedBy: person(MAYA),
    approvedAt: daysAgo(12),
    supersedes: 'memory_branches',
    runs: 31,
  }),
  memory({
    id: 'memory_branches',
    handle: 'M-12',
    kind: 'preference',
    status: 'retired',
    body: 'Name branches after the person who opened the task.',
    approvedBy: person(MAYA),
    approvedAt: daysAgo(40),
    retirement: {
      at: daysAgo(12),
      by: null,
      reason: null,
      supersededBy: 'memory_branches_ticket',
    },
    runs: 54,
  }),
  memory({
    id: 'memory_flaky',
    handle: 'M-27',
    kind: 'failure',
    status: 'retired',
    lineId: DELIVERY_ID,
    repository: 'acme/api',
    body: 'The checkout end-to-end test flakes when the card iframe loads slowly; rerun it once before calling it broken.',
    approvedBy: person(TOM),
    approvedAt: daysAgo(30),
    retirement: {
      at: daysAgo(6),
      by: person(MAYA),
      reason:
        'The card iframe is mocked in CI now, so a failure there is real.',
      supersededBy: null,
    },
    runs: 18,
  }),
];

const GROWTH_MEMORIES: MemoryRecord[] = [
  memory({
    id: 'memory_copy_voice',
    handle: 'M-44',
    kind: 'preference',
    body: 'Write product copy in the second person, and keep button labels to two words.',
    approvedBy: person(PRIYA),
    approvedAt: daysAgo(5),
    runs: 6,
  }),
  memory({
    id: 'memory_pricing_flag',
    handle: 'M-45',
    kind: 'rationale',
    source: 'run',
    lineId: EXPERIMENTS_ID,
    repository: 'acme/web',
    paths: ['src/pricing/PlansPage.tsx'],
    body: 'The annual toggle stays behind the pricing_annual flag until finance signs off on the discount.',
    approvedBy: person(PRIYA),
    approvedAt: hoursAgo(37),
    grounds: { taskId: 'task_pricing_toggle', runId: 'run_pricing_1' },
    runs: 1,
    harness: 'claude-code',
    steps: [groundStep('run_pricing_1', PRICING_FLAG_MESSAGE)],
  }),
  memory({
    id: 'memory_posthog',
    handle: 'M-49',
    kind: 'environment',
    lineId: EXPERIMENTS_ID,
    repository: 'acme/web',
    body: 'Preview deploys need NEXT_PUBLIC_POSTHOG_KEY set, or every experiment flag reads as off.',
    approvedBy: person(PRIYA),
    approvedAt: daysAgo(2),
    runs: 4,
  }),
  memory({
    id: 'memory_referral_copy',
    handle: 'M-33',
    kind: 'correction',
    status: 'retired',
    lineId: EXPERIMENTS_ID,
    body: 'Invite emails carry no referral link while the referral programme is paused.',
    approvedBy: person(PRIYA),
    approvedAt: daysAgo(20),
    retirement: {
      at: daysAgo(12),
      by: person(PRIYA),
      reason: 'The referral programme is back on.',
      supersededBy: null,
    },
    runs: 9,
  }),
];

export const MEMORY_SEED: Record<string, MemoryRecord[]> = {
  [PLATFORM_ID]: PLATFORM_MEMORIES,
  [GROWTH_ID]: GROWTH_MEMORIES,
};

export const teamMemories = perWorld(
  (kind): Record<string, MemoryRecord[]> =>
    kind === 'empty'
      ? { [PLATFORM_ID]: [], [GROWTH_ID]: [] }
      : structuredClone(MEMORY_SEED),
);
