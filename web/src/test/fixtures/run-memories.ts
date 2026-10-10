import type { QueryClient } from '@tanstack/react-query';
import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import type { RunMemoriesResponseDto, TeamMemoryResponseDto } from '@/lib/api';
import { failQuery } from '@/test/failQuery';
import { MAYA_IMAGE } from '@/test/fixtures/avatars';
import { MEMORIES_ITEM_ID } from '@/test/fixtures/memories';

const MAYA = { id: 'user_2', name: 'Maya Chen', image: MAYA_IMAGE };

const memory = (
  over: Partial<TeamMemoryResponseDto> & {
    id: string;
    handle: string;
    body: string;
  },
): TeamMemoryResponseDto => ({
  kind: 'preference',
  source: 'person',
  standing: 'stands',
  reach: 'team',
  lineId: null,
  stationId: null,
  repository: null,
  paths: [],
  approvedBy: MAYA,
  approvedAt: '2026-09-15T11:40:00.000Z',
  supersedes: null,
  retirement: null,
  grounds: null,
  runs: 4,
  ...over,
});

const REMEMBERED: RunMemoriesResponseDto = {
  briefed: [
    memory({
      id: 'memory_gone',
      handle: 'M-42',
      kind: 'rationale',
      source: 'run',
      reach: 'station',
      repository: 'acme/worker',
      paths: ['src/retries/deliver.ts'],
      body: 'A 410 Gone from a webhook endpoint is permanent, so its deliveries are dropped rather than retried.',
      runs: 7,
    }),
    memory({
      id: 'memory_billing',
      handle: 'M-41',
      kind: 'correction',
      body: 'Leave billing-retries alone while billing is being reconciled; drain webhook-retries first.',
    }),
  ],
  cut: [
    memory({
      id: 'memory_staging',
      handle: 'M-43',
      kind: 'environment',
      reach: 'line',
      body: 'The staging queue worker must be restarted after every deploy, or it keeps the old retry limits.',
      runs: 2,
    }),
  ],
  recalled: [
    memory({
      id: 'memory_backoff',
      handle: 'M-38',
      kind: 'rejected-approach',
      body: 'Exponential backoff past five minutes was tried and dropped: the queue fills faster than it drains.',
      standing: 'retired',
      retirement: {
        at: '2026-09-26T09:00:00.000Z',
        by: MAYA,
        reason: 'The queue drains in parallel now.',
        supersededBy: null,
      },
      runs: 9,
    }),
  ],
  proposed: [
    {
      id: 'memory_asked',
      kind: 'failure',
      body: 'The retry worker test hangs when Redis is not running locally.',
      source: 'run',
      origin: 'remembered',
      state: 'proposed',
      reach: 'line',
      repository: null,
      paths: [],
      supersedes: null,
      decision: null,
      harness: 'claude-code',
      steps: [],
      notes: [],
      handle: null,
      standing: null,
    },
  ],
  reviewItemId: MEMORIES_ITEM_ID,
};

export const seedRunMemories = (
  client: QueryClient,
  teamId: string,
  runId: string,
) => client.setQueryData(runMemoryKeys.forRun(teamId, runId), REMEMBERED);

export const seedNoRunMemories = (
  client: QueryClient,
  teamId: string,
  runId: string,
) =>
  client.setQueryData(runMemoryKeys.forRun(teamId, runId), {
    briefed: [],
    cut: [],
    recalled: [],
    proposed: [],
    reviewItemId: null,
  });

export const failRunMemories = (
  client: QueryClient,
  teamId: string,
  runId: string,
) => failQuery(client, runMemoryKeys.forRun(teamId, runId));
