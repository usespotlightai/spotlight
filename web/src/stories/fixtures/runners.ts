import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { runnerKeys } from '@/hooks/api/useRunners';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type {
  HarnessResponseDto,
  HostImageResponseDto,
  WorkspaceResponseDto,
} from '@/lib/api';
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

const DIGEST =
  'a3f9c2e17b4d58f6e0c1a2b3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b';

const image = (
  name: string,
  harnesses: readonly [string, string][],
  over: Partial<HostImageResponseDto> = {},
): HostImageResponseDto => ({
  image: name,
  digest: `${name.replace(/:[^/:]+$/, '')}@sha256:${DIGEST}`,
  usual: false,
  release: '20260925-01',
  harnesses: harnesses.map(([id, version]) => ({ id, version })),
  refused: null,
  ...over,
});

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
      images: [
        image(
          'ghcr.io/usespotlightai/spotlight-runner:20260925-01',
          [
            ['claude-code', '2.1.270'],
            ['cursor', '2026.09.18'],
          ],
          { usual: true },
        ),
        image('ghcr.io/acme/api-runner:main', [['claude-code', '2.1.270']]),
      ],
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
      images: [
        image(
          'ghcr.io/usespotlightai/spotlight-runner:20260925-01',
          [
            ['claude-code', '2.1.270'],
            ['cursor', '2026.09.18'],
            ['codex', '0.41.0'],
            ['gemini', '0.9.1'],
          ],
          { usual: true },
        ),
        image('ghcr.io/acme/legacy-runner:2025', [], {
          release: null,
          refused:
            'its runner reports no release, so it is older than the 20260925-01 this control plane needs',
        }),
      ],
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
      images: [
        image(
          'ghcr.io/usespotlightai/spotlight-runner:20260801-02',
          [['claude-code', '2.1.180']],
          { usual: true, release: '20260801-02' },
        ),
      ],
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
      image: null,
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

const emptyAs =
  (role: WorkspaceResponseDto['role']) => (client: QueryClient) => {
    client.setQueryData(runnerKeys.forWorkspace(SLUG), {
      hosts: [],
      provisioned: [],
    } satisfies Fleet);
    client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
    client.setQueryData(workspaceKeys.detail(SLUG), {
      id: 'workspace_acme',
      name: 'Acme',
      slug: SLUG,
      role,
      teams: [],
    } satisfies WorkspaceResponseDto);
  };

export const emptyRunners = emptyAs('owner');

export const emptyRunnersForMember = emptyAs('member');

export const failRunners = (client: QueryClient) =>
  failQuery(client, runnerKeys.forWorkspace(SLUG));
