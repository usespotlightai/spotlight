import type {
  CredentialSourceResponseDto,
  HostHarnessResponseDto,
  HostResponseDto,
  IdleSandboxResponseDto,
  LeasedRunResponseDto,
  LiveRunnerResponseDto,
  RunnerActivityResponseDto,
  RunnerFleetResponseDto,
} from '@/lib/api';
import { runPath } from '@/lib/run';
import { settingsPath } from '@/lib/settings';
import { since } from '@/lib/since';

export type LeasedRun = LeasedRunResponseDto;

export type ActiveRunner = LiveRunnerResponseDto & {
  readonly currentRun: LeasedRun | null;
};

export type IdleSandbox = IdleSandboxResponseDto & {
  readonly lastRun: LeasedRun | null;
};

export type Host = Omit<HostResponseDto, 'idleSandboxes'> & {
  readonly runners: readonly ActiveRunner[];
  readonly idleSandboxes: readonly IdleSandbox[];
};

export type PushPool = {
  readonly source: CredentialSourceResponseDto;
  readonly runners: readonly ActiveRunner[];
};

export type Fleet = {
  readonly hosts: readonly Host[];
  readonly pools: readonly PushPool[];
};

export const poolKeyOf = (source: CredentialSourceResponseDto): string =>
  `${source.kind}:${source.key ?? ''}`;

export const withActivity = (
  fleet: RunnerFleetResponseDto,
  activity: RunnerActivityResponseDto,
): Fleet => {
  const runners: ActiveRunner[] = fleet.runners.map((runner) => ({
    ...runner,
    currentRun:
      activity.runners.find((each) => each.runnerId === runner.id)
        ?.currentRun ?? null,
  }));
  const lastRunOf = (key: string | null): LeasedRun | null =>
    activity.workingCopies.find((each) => each.key === key)?.lastRun ?? null;
  const unhosted = runners.filter((runner) => runner.hostId === null);
  const pools = [
    ...new Set(unhosted.map((runner) => poolKeyOf(runner.source))),
  ];

  return {
    hosts: fleet.hosts.map((host) => ({
      ...host,
      runners: runners.filter((runner) => runner.hostId === host.id),
      idleSandboxes: host.idleSandboxes.map((sandbox) => ({
        ...sandbox,
        lastRun: lastRunOf(sandbox.key),
      })),
    })),
    pools: pools.flatMap((key) => {
      const pooled = unhosted.filter(
        (runner) => poolKeyOf(runner.source) === key,
      );
      const first = pooled[0];

      return first ? [{ source: first.source, runners: pooled }] : [];
    }),
  };
};

export const imageShortName = (image: string): string =>
  image.slice(image.lastIndexOf('/') + 1);

export const runnersPath = (slug: string) => `${settingsPath(slug)}/runners`;

export const addHostPath = (slug: string) => `${runnersPath(slug)}/new`;

export const installCommand = (token: string) =>
  `curl -fsSL ${window.location.origin}/api/install.sh | sh -s -- --token ${token}`;

export const onlineCount = (fleet: Fleet) =>
  fleet.hosts.filter((host) => host.online).length;

export const hostStatus = (host: Host): string => {
  if (!host.online) {
    return 'Offline';
  }

  return host.runners.length > 0 ? `Running ${host.runners.length}` : 'Idle';
};

export const hostSlots = (host: Host): string | null =>
  host.online ? `${host.slotsTaken} of ${host.capacity}` : null;

export const sourceLabel = (source: CredentialSourceResponseDto): string => {
  const kind = source.kind === 'pool' ? 'Pool' : 'Trust';
  return source.key === null ? `${kind} deleted` : `${kind} ${source.key}`;
};

export const heartbeatAt = (host: Host): string =>
  host.online
    ? `Online since ${since(host.onlineSince)}`
    : `Last heartbeat ${since(host.lastHeartbeatAt)}`;

export type NamedHarness = {
  readonly id: string;
  readonly name: string;
  readonly version?: string | null;
};

const nameOf = (
  id: string,
  harnesses: readonly NamedHarness[] | undefined,
): string => harnesses?.find((harness) => harness.id === id)?.name ?? id;

export const harnessesOf = (
  ids: readonly string[],
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] => ids.map((id) => ({ id, name: nameOf(id, harnesses) }));

const namedHarnesses = (
  reported: readonly HostHarnessResponseDto[],
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  reported.map((each) => ({
    id: each.id,
    name: nameOf(each.id, harnesses),
    version: each.version,
  }));

export const servedBy = (
  host: Host,
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  namedHarnesses(
    host.images
      .filter((image) => !image.unavailableReason)
      .flatMap((image) => image.harnesses)
      .filter(
        (each, at, all) =>
          all.findIndex((other) => other.id === each.id) === at,
      ),
    harnesses,
  );

export const poolHarnesses = (
  pool: PushPool,
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  harnessesOf(
    [...new Set(pool.runners.flatMap((runner) => runner.harnesses))],
    harnesses,
  );

export const RUNNER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'idle', label: 'Idle' },
  { id: 'offline', label: 'Offline' },
] as const;

export type RunnerFilter = (typeof RUNNER_FILTERS)[number]['id'];

export const FALLBACK_RUNNER_FILTER: RunnerFilter = 'all';

export const asRunnerFilter = (raw: string): RunnerFilter =>
  RUNNER_FILTERS.some((filter) => filter.id === raw)
    ? (raw as RunnerFilter)
    : FALLBACK_RUNNER_FILTER;

export const hostInFilter = (filter: RunnerFilter, host: Host): boolean => {
  switch (filter) {
    case 'all':
      return true;
    case 'running':
      return host.online && host.runners.length > 0;
    case 'idle':
      return host.online && host.runners.length === 0;
    case 'offline':
      return !host.online;
  }
};

export const poolInFilter = (filter: RunnerFilter, pool: PushPool): boolean =>
  filter === 'all' ||
  (filter === 'running' &&
    pool.runners.some((runner) => runner.currentRun !== null));

export const poolName = (source: CredentialSourceResponseDto): string =>
  source.key ?? 'Deleted';

export const PUSH_POOL = 'Push pool';

export const poolStatus = (pool: PushPool): string => {
  const running = pool.runners.filter(
    (runner) => runner.currentRun !== null,
  ).length;

  return running > 0 ? `Running ${running}` : 'Starting';
};

export const runnerStatus = (runner: ActiveRunner): string => {
  return runner.currentRun ? 'Running' : 'Starting';
};

type UnnamedKind = Exclude<LeasedRun['kind'], 'task' | 'chat'>;

const UNNAMED_RUNS: Record<UnnamedKind, string> = {
  replay: 'A replay run',
  search: 'A search run',
  spec: 'A run queued by hand',
};

const isUnnamed = (kind: LeasedRun['kind']): kind is UnnamedKind =>
  kind in UNNAMED_RUNS;

export const hiddenRunTip = (run: LeasedRun): string =>
  run.kind === 'chat'
    ? 'Title hidden. This agent chat belongs to a team you’re not on.'
    : 'Title hidden. This run belongs to a team you’re not on.';

export const formatRun = (run: LeasedRun | null): string => {
  if (run === null) {
    return 'No run yet';
  }

  return (
    run.title ??
    (isUnnamed(run.kind) ? UNNAMED_RUNS[run.kind] : hiddenRunTip(run))
  );
};

export const hiddenFromViewer = (run: LeasedRun | null): boolean =>
  run !== null &&
  !run.readable &&
  run.teamId !== null &&
  (run.kind === 'task' || run.kind === 'chat');

export const leasedRunPath = (
  slug: string,
  run: LeasedRun | null,
): string | null =>
  run?.kind === 'task' && run.readable && run.teamId !== null
    ? runPath(slug, run.teamId, run.id)
    : null;

const WARM_SANDBOX = 'Warm sandbox';

export const warmSandboxLabel = (lineName: string | undefined): string =>
  lineName ? `${WARM_SANDBOX} for ${lineName}` : WARM_SANDBOX;

export const idleSandboxLabel = (sandbox: IdleSandbox): string =>
  sandbox.lastRun ? formatRun(sandbox.lastRun) : 'Idle sandbox';

const IDLE_SANDBOX_STATUSES: Record<
  IdleSandbox['status'],
  { warm: string; kept: string }
> = {
  starting: { warm: 'Starting', kept: 'Starting' },
  ready: { warm: 'Ready', kept: 'Waiting' },
  draining: { warm: 'Stopping', kept: 'Stopping' },
};

export const idleSandboxStatus = (sandbox: IdleSandbox): string =>
  IDLE_SANDBOX_STATUSES[sandbox.status][
    sandbox.warmLineId === null ? 'kept' : 'warm'
  ];

export const idleSandboxActivity = (sandbox: IdleSandbox): string =>
  sandbox.warmLineId === null
    ? `Idle since ${since(sandbox.idleSince)}`
    : `Started ${since(sandbox.startedAt)}`;

export const NONE_IN_FILTER: Record<Exclude<RunnerFilter, 'all'>, string> = {
  running: 'No runs in progress.',
  idle: 'No idle hosts.',
  offline: 'All hosts are online.',
};

export const connectedIn = (
  fleet: Fleet | undefined,
  pool: string,
): Host | undefined =>
  fleet?.hosts.find(
    (host) =>
      host.online && host.source.kind === 'pool' && host.source.key === pool,
  );

const SUGGESTED_POOL = 'my-computer';

export const suggestedPoolName = (taken: readonly string[]): string => {
  const names = new Set(taken);
  let n = 1;
  while (names.has(`${SUGGESTED_POOL}-${n}`)) {
    n += 1;
  }
  return `${SUGGESTED_POOL}-${n}`;
};
