import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { runnerKeys } from '@/hooks/api/useRunners';
import type { HarnessResponseDto } from '@/lib/api';
import type { Fleet } from '@/lib/runner';
import { failQuery } from '@/stories/failQuery';

export const SLUG = 'acme';

const MINUTE = 60_000;

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * MINUTE).toISOString();

const harness = (id: string, name: string): HarnessResponseDto => ({
  id,
  name,
  models: [],
  defaultModel: '',
  efforts: [],
});

const HARNESSES: HarnessResponseDto[] = [
  harness('claude-code', 'Claude Code'),
  harness('cursor', 'Cursor'),
  harness('codex', 'Codex'),
  harness('gemini', 'Gemini CLI'),
];

const FLEET: Fleet = {
  hosts: [
    {
      id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
      name: 'build-box-1',
      through: { kind: 'pool', key: 'build-farm' },
      release: 'v1.4.0',
      executor: 'Docker Engine - Community 27.3.1 (linux/amd64)',
      capacity: 4,
      running: ['runner_1', 'runner_2'],
      harnesses: ['claude-code', 'cursor'],
      firstSeenAt: minutesAgo(3 * 24 * 60),
      lastSeenAt: minutesAgo(0),
      answering: true,
      runs: [
        { id: 'run_retries_2', state: 'running' },
        { id: 'run_docs_1', state: 'claimed' },
      ],
    },
    {
      id: 'M3N8P2Q7R4S9T1V6W5X0Y2Z4AB',
      name: 'sams-mac-mini',
      through: { kind: 'pool', key: 'build-farm' },
      release: 'v1.4.0',
      executor: 'OrbStack 1.9.2 (linux/arm64)',
      capacity: 2,
      running: [],
      harnesses: ['claude-code', 'cursor', 'codex', 'gemini'],
      firstSeenAt: minutesAgo(40),
      lastSeenAt: minutesAgo(0),
      answering: true,
      runs: [],
    },
    {
      id: 'C9D4E7F2G5H8J1K3L6M9N2P5Q8',
      name: 'gpu-node-3',
      through: { kind: 'trust', key: 'production-cluster' },
      release: 'v1.3.2',
      executor: 'Podman Engine 5.2.1 (linux/amd64)',
      capacity: 8,
      running: [],
      harnesses: ['claude-code'],
      firstSeenAt: minutesAgo(9 * 60),
      lastSeenAt: minutesAgo(3 * 60),
      answering: false,
      runs: [],
    },
  ],
  provisioned: [
    {
      id: 'runner_cloud_1',
      through: { kind: 'pool', key: 'ephemeral' },
      hostId: null,
      harnesses: ['claude-code'],
      startedAt: minutesAgo(4),
      lastSeenAt: minutesAgo(0),
      currentRun: { id: 'run_triage_9', state: 'running' },
    },
  ],
};

export const seedRunners = (client: QueryClient) => {
  client.setQueryData(runnerKeys.forWorkspace(SLUG), FLEET);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
};

export const emptyRunners = (client: QueryClient) => {
  client.setQueryData(runnerKeys.forWorkspace(SLUG), {
    hosts: [],
    provisioned: [],
  } satisfies Fleet);
  client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
};

export const failRunners = (client: QueryClient) =>
  failQuery(client, runnerKeys.forWorkspace(SLUG));
