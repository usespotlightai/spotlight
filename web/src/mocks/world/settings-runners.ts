import type {
  HostImageResponseDto,
  HostResponseDto,
  LeasedRunResponseDto,
  LiveRunnerResponseDto,
  RunnerActivityResponseDto,
  RunnerPoolResourceResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { GROWTH_ID, PLATFORM_ID } from '@/mocks/world';

export type Fleet = {
  hosts: HostResponseDto[];
  runners: LiveRunnerResponseDto[];
  activity: RunnerActivityResponseDto[];
};

const WORKSPACE_ID = 'workspace_acme';

const RUNNER_IMAGE = 'ghcr.io/usespotlightai/spotlight-runner:20260925-01';

const API_IMAGE = 'ghcr.io/acme/api-runner:main';

const DIGEST =
  'a3f9c2e17b4d58f6e0c1a2b3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b';

const minutesAgo = (minutes: number) => hoursAgo(minutes / 60);

const image = (
  name: string,
  harnesses: readonly [string, string][],
  over: Partial<HostImageResponseDto> = {},
): HostImageResponseDto => ({
  image: name,
  digest: `${name.replace(/:[^/:]+$/, '')}@sha256:${DIGEST}`,
  isDefault: false,
  release: '20260925-01',
  harnesses: harnesses.map(([id, version]) => ({ id, version })),
  unavailableReason: null,
  ...over,
});

const BUILD_BOX = 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P';

const MAC_MINI = 'M3N8P2Q7R4S9T1V6W5X0Y2Z4AB';

const GPU_NODE = 'C9D4E7F2G5H8J1K3L6M9N2P5Q8';

const BUILD_FARM = { kind: 'pool', key: 'build-farm' } as const;

const EPHEMERAL = { kind: 'pool', key: 'ephemeral' } as const;

const HOSTS: HostResponseDto[] = [
  {
    id: BUILD_BOX,
    name: 'build-box-1',
    source: BUILD_FARM,
    release: '20261018-01',
    unavailableReason: null,
    containerRuntime: 'Docker Engine - Community 27.3.1 (linux/amd64)',
    capacity: 4,
    running: ['runner_build_1', 'runner_build_2'],
    images: [
      image(
        RUNNER_IMAGE,
        [
          ['claude-code', '2.1.270'],
          ['codex', '0.41.0'],
        ],
        { isDefault: true },
      ),
      image(API_IMAGE, [['claude-code', '2.1.270']]),
    ],
    firstHeartbeatAt: minutesAgo(9 * 24 * 60),
    onlineSince: minutesAgo(26 * 60),
    lastHeartbeatAt: minutesAgo(0),
    online: true,
  },
  {
    id: MAC_MINI,
    name: 'sams-mac-mini',
    source: BUILD_FARM,
    release: '20261018-01',
    unavailableReason: null,
    containerRuntime: 'OrbStack 1.9.2 (linux/arm64)',
    capacity: 2,
    running: [],
    images: [
      image(
        RUNNER_IMAGE,
        [
          ['claude-code', '2.1.270'],
          ['codex', '0.41.0'],
          ['cursor', '2026.09.18'],
        ],
        { isDefault: true },
      ),
      image('ghcr.io/acme/legacy-runner:2025', [], {
        release: null,
        unavailableReason:
          'Runner doesn’t report its release number. Minimum version required: 20260925-01',
      }),
    ],
    firstHeartbeatAt: minutesAgo(3 * 24 * 60),
    onlineSince: minutesAgo(5 * 60),
    lastHeartbeatAt: minutesAgo(0),
    online: true,
  },
  {
    id: GPU_NODE,
    name: 'gpu-node-3',
    source: { kind: 'trust', key: 'production-cluster' },
    release: '20261001-04',
    unavailableReason:
      'Host is on release 20261001-04. Minimum release required: 20261002-02. Update it with: spotlight host update',
    containerRuntime: 'Podman Engine 5.2.1 (linux/amd64)',
    capacity: 8,
    running: [],
    images: [
      image(
        RUNNER_IMAGE.replace('20260925-01', '20260801-02'),
        [['claude-code', '2.1.180']],
        { isDefault: true, release: '20260801-02' },
      ),
    ],
    firstHeartbeatAt: minutesAgo(12 * 24 * 60),
    onlineSince: minutesAgo(30 * 60),
    lastHeartbeatAt: minutesAgo(3 * 60),
    online: false,
  },
];

const runner = (
  over: Partial<LiveRunnerResponseDto> & { id: string; minutes: number },
): LiveRunnerResponseDto => {
  const { minutes, ...rest } = over;

  return {
    source: BUILD_FARM,
    hostId: BUILD_BOX,
    image: RUNNER_IMAGE,
    harnesses: ['claude-code', 'codex'],
    startedAt: minutesAgo(minutes),
    lastHeartbeatAt: minutesAgo(0),
    ...rest,
  };
};

const pushed = (id: string, minutes: number): LiveRunnerResponseDto =>
  runner({
    id,
    minutes,
    source: EPHEMERAL,
    hostId: null,
    image: null,
    harnesses: ['claude-code'],
  });

const RUNNERS: LiveRunnerResponseDto[] = [
  runner({ id: 'runner_build_1', minutes: 13 }),
  runner({ id: 'runner_build_2', minutes: 19, image: API_IMAGE }),
  pushed('runner_push_1', 31),
  pushed('runner_push_2', 25),
  pushed('runner_push_3', 9),
];

const leasedRun = (
  id: string,
  teamId: string,
  title: string,
): LeasedRunResponseDto => ({
  id,
  state: 'claimed',
  kind: 'task',
  teamId,
  readable: true,
  title,
});

const ACTIVITY: RunnerActivityResponseDto[] = [
  {
    runnerId: 'runner_build_1',
    currentRun: leasedRun(
      'run_retries_3',
      PLATFORM_ID,
      'Drain the stuck retry queues',
    ),
  },
  {
    runnerId: 'runner_build_2',
    currentRun: leasedRun(
      'run_checkout_1',
      PLATFORM_ID,
      'Flaky checkout test on CI',
    ),
  },
  {
    runnerId: 'runner_push_1',
    currentRun: leasedRun(
      'run_latency_1',
      PLATFORM_ID,
      'p99 latency alert on the payments API',
    ),
  },
  {
    runnerId: 'runner_push_2',
    currentRun: leasedRun(
      'run_pricing_2',
      GROWTH_ID,
      'Annual pricing toggle on the plans page',
    ),
  },
  {
    runnerId: 'runner_push_3',
    currentRun: leasedRun(
      'run_survey_1',
      GROWTH_ID,
      'Ask new signups how they found us',
    ),
  },
];

export const FLEET: Fleet = {
  hosts: HOSTS,
  runners: RUNNERS,
  activity: ACTIVITY,
};

export const NO_FLEET: Fleet = { hosts: [], runners: [], activity: [] };

const pool = (
  key: string,
  over: Partial<RunnerPoolResourceResponseDto> = {},
): RunnerPoolResourceResponseDto => ({
  id: `pool_${key.replace(/-/g, '_')}`,
  version: 1,
  address: key,
  warnings: [],
  workspaceId: WORKSPACE_ID,
  key,
  labels: [],
  maxRuns: null,
  mode: 'pull',
  tokenVersion: 1,
  provision: null,
  ...over,
});

export const RUNNER_POOLS: RunnerPoolResourceResponseDto[] = [
  pool('build-farm', { labels: ['linux', 'docker'], maxRuns: 6 }),
  pool('ephemeral', {
    mode: 'push',
    maxRuns: 10,
    tokenVersion: null,
    provision: {
      url: 'https://runners.acme.dev/spotlight/provision',
      secretVersion: 2,
      egress: 'spotlight',
      egressTraffic: 'all',
    },
  }),
];

export const newRunnerPool = (key: string): RunnerPoolResourceResponseDto =>
  pool(key, { tokenVersion: 1 });
