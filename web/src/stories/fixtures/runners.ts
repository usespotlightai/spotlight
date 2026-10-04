import type { QueryClient } from '@tanstack/react-query';
import { harnessKeys } from '@/hooks/api/useHarnesses';
import { runnerPoolKeys } from '@/hooks/api/useRunnerPools';
import { runnerKeys } from '@/hooks/api/useRunners';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type { HostImageResponseDto, WorkspaceResponseDto } from '@/lib/api';
import type { ActiveRunner, Fleet } from '@/lib/runner';
import { failQuery } from '@/stories/failQuery';
import { HARNESSES } from '@/stories/fixtures/harnesses';

export const SLUG = 'acme';

const MINUTE = 60_000;

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * MINUTE).toISOString();

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

const USUAL_IMAGE = 'ghcr.io/usespotlightai/spotlight-runner:20260925-01';

const active = (over: Partial<ActiveRunner>): ActiveRunner => ({
  id: 'runner_1',
  through: { kind: 'pool', key: 'build-farm' },
  hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  image: USUAL_IMAGE,
  harnesses: ['claude-code'],
  startedAt: minutesAgo(3),
  lastSeenAt: minutesAgo(0),
  currentRun: null,
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
      upSince: minutesAgo(2 * 60),
      lastSeenAt: minutesAgo(0),
      answering: true,
      runners: [
        active({
          id: 'runner_1',
          startedAt: minutesAgo(3),
          currentRun: {
            id: 'run_retries_2',
            state: 'running',
            kind: 'task',
            teamId: 'team_platform',
            readable: true,
            title: 'Drain the stuck retry queues',
          },
        }),
        active({
          id: 'runner_2',
          image: 'ghcr.io/acme/api-runner:main',
          startedAt: minutesAgo(9),
          currentRun: {
            id: 'run_docs_1',
            state: 'claimed',
            kind: 'task',
            teamId: 'team_billing',
            readable: false,
            title: null,
          },
        }),
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
      upSince: minutesAgo(40),
      lastSeenAt: minutesAgo(0),
      answering: true,
      runners: [],
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
      upSince: minutesAgo(9 * 60),
      lastSeenAt: minutesAgo(3 * 60),
      answering: false,
      runners: [],
    },
  ],
  pools: [
    {
      through: { kind: 'pool', key: 'ephemeral' },
      runners: [
        active({
          id: 'runner_cloud_1',
          through: { kind: 'pool', key: 'ephemeral' },
          hostId: null,
          image: null,
          startedAt: minutesAgo(4),
          currentRun: {
            id: 'run_triage_9',
            state: 'running',
            kind: 'chat',
            teamId: 'team_platform',
            readable: true,
            title: 'Plan the webhook retry policy',
          },
        }),
      ],
    },
  ],
};

const holding =
  (fleet: Fleet, role: WorkspaceResponseDto['role']) =>
  (client: QueryClient) => {
    client.setQueryData(runnerKeys.forWorkspace(SLUG), fleet);
    client.setQueryData(harnessKeys.forWorkspace(SLUG), HARNESSES);
    client.setQueryData(runnerPoolKeys.forWorkspace('workspace_acme'), [
      { key: 'my-computer-1' },
    ]);
    client.setQueryData(workspaceKeys.detail(SLUG), {
      id: 'workspace_acme',
      name: 'Acme',
      slug: SLUG,
      role,
      teams: [],
    } satisfies WorkspaceResponseDto);
  };

const pushed = (pool: string, over: Partial<ActiveRunner>): ActiveRunner =>
  active({
    through: { kind: 'pool', key: pool },
    hostId: null,
    image: null,
    ...over,
  });

const PUSH_FLEET: Fleet = {
  hosts: [],
  pools: [
    {
      through: { kind: 'pool', key: 'ephemeral' },
      runners: [
        pushed('ephemeral', {
          id: 'runner_push_1',
          startedAt: minutesAgo(4),
          currentRun: {
            id: 'run_retries_3',
            state: 'claimed',
            kind: 'task',
            teamId: 'team_platform',
            readable: true,
            title: 'Drain the stuck retry queues',
          },
        }),
        pushed('ephemeral', {
          id: 'runner_push_2',
          harnesses: ['claude-code', 'codex'],
          startedAt: minutesAgo(11),
          currentRun: {
            id: 'run_billing_4',
            state: 'claimed',
            kind: 'task',
            teamId: 'team_billing',
            readable: false,
            title: null,
          },
        }),
        pushed('ephemeral', {
          id: 'runner_push_3',
          startedAt: minutesAgo(26),
          currentRun: {
            id: 'run_docs_5',
            state: 'waiting',
            kind: 'task',
            teamId: 'team_platform',
            readable: true,
            title: 'Document the webhook retry policy',
          },
        }),
      ],
    },
    {
      through: { kind: 'pool', key: 'burst' },
      runners: [
        pushed('burst', {
          id: 'runner_push_4',
          harnesses: ['cursor'],
          startedAt: minutesAgo(2),
          currentRun: {
            id: 'run_search_6',
            state: 'claimed',
            kind: 'search',
            teamId: 'team_platform',
            readable: true,
            title: null,
          },
        }),
        pushed('burst', {
          id: 'runner_push_5',
          startedAt: minutesAgo(1),
          currentRun: {
            id: 'run_replay_7',
            state: 'claimed',
            kind: 'replay',
            teamId: 'team_platform',
            readable: true,
            title: null,
          },
        }),
        pushed('burst', {
          id: 'runner_push_6',
          startedAt: minutesAgo(0),
          currentRun: null,
        }),
      ],
    },
  ],
};

export const seedRunners = holding(FLEET, 'owner');

export const seedPushRunners = holding(PUSH_FLEET, 'owner');

const emptyAs = (role: WorkspaceResponseDto['role']) =>
  holding({ hosts: [], pools: [] }, role);

export const emptyRunners = emptyAs('owner');

export const emptyRunnersForMember = emptyAs('member');

export const failRunners = (client: QueryClient) =>
  failQuery(client, runnerKeys.forWorkspace(SLUG));
