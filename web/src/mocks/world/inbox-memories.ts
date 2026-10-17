import type {
  MemoryReviewResponseDto,
  ProposedMemoryResponseDto,
} from '@/lib/api';
import { minutesAfter, runEnded } from '@/mocks/world/inbox-places';
import { MAYA, TOM } from '@/mocks/world/people';
import {
  DISK_DUMPS_MESSAGE,
  DRAIN_ANSWER,
  GONE_REMEMBER,
  GONE_THOUGHT,
  groundStep,
} from '@/mocks/world/work-stories';

const RUN_ID = 'run_retries_2';
const DISK_RUN_ID = 'run_disk_1';

const decidedByTom = (minutes: number) => ({
  by: TOM.id,
  name: TOM.name,
  at: minutesAfter(runEnded(DISK_RUN_ID), minutes),
});

const proposed = (
  over: Partial<ProposedMemoryResponseDto> &
    Pick<ProposedMemoryResponseDto, 'id' | 'kind' | 'body' | 'source'>,
): ProposedMemoryResponseDto => ({
  origin: 'drafted',
  state: 'proposed',
  reach: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  decision: null,
  harness: 'claude-code',
  steps: [],
  notes: [],
  ...over,
});

export const seedMemoryReviews = (): Record<
  string,
  MemoryReviewResponseDto
> => ({
  [RUN_ID]: {
    taskId: 'task_retries',
    runId: RUN_ID,
    memories: [
      proposed({
        id: 'memory_billing',
        kind: 'correction',
        source: 'person',
        state: 'approved',
        body: 'Leave billing-retries alone while billing is being reconciled; drain webhook-retries first.',
        decision: {
          by: MAYA.id,
          name: MAYA.name,
          at: minutesAfter(runEnded(RUN_ID), 20),
        },
        notes: [
          {
            position: 1,
            by: 'person',
            author: MAYA,
            text: DRAIN_ANSWER,
          },
        ],
      }),
      proposed({
        id: 'memory_gone',
        kind: 'rationale',
        source: 'run',
        origin: 'remembered',
        state: 'approved',
        decision: {
          by: MAYA.id,
          name: MAYA.name,
          at: minutesAfter(runEnded(RUN_ID), 20),
        },
        reach: 'station',
        repository: 'acme/worker',
        paths: ['src/retries/deliver.ts'],
        body: 'A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried.',
        steps: [
          groundStep(RUN_ID, GONE_THOUGHT),
          groundStep(RUN_ID, GONE_REMEMBER, 'remember'),
        ],
      }),
      proposed({
        id: 'memory_redeploy_check',
        kind: 'failure',
        source: 'outside',
        reach: 'line',
        repository: 'acme/worker',
        body: 'After the queue worker is redeployed, check the retry queues for jobs that never ran; a redeploy can leave them stranded.',
        notes: [
          {
            position: 0,
            by: 'world',
            author: null,
            text: 'Webhook deliveries have been failing since the queue worker was redeployed on Friday.',
          },
        ],
      }),
    ],
  },
  [DISK_RUN_ID]: {
    taskId: 'task_disk',
    runId: DISK_RUN_ID,
    memories: [
      proposed({
        id: 'memory_crash_dumps',
        kind: 'environment',
        source: 'run',
        origin: 'remembered',
        state: 'approved',
        reach: 'station',
        repository: 'acme/infra',
        paths: ['terraform/workers/eu-west-1.tf'],
        body: 'Workers in eu-west-1 write core dumps to /var/crash; clear them before resizing a disk, or the resize fills up again within a day.',
        decision: decidedByTom(70),
        steps: [groundStep(DISK_RUN_ID, DISK_DUMPS_MESSAGE)],
      }),
      proposed({
        id: 'memory_disk_size',
        kind: 'preference',
        source: 'run',
        state: 'rejected',
        reach: 'line',
        repository: 'acme/infra',
        body: 'Size eu-west-1 worker disks at 200 GB, double the other regions.',
        decision: decidedByTom(72),
      }),
    ],
  },
});
