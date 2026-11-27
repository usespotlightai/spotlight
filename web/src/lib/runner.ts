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
import type { TooltipNote } from '@/lib/tooltip-note';

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
  const lastRunOf = (workingCopyKey: string | null): LeasedRun | null =>
    activity.workingCopies.find(
      (each) => each.workingCopyKey === workingCopyKey,
    )?.lastRun ?? null;
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
        lastRun: lastRunOf(sandbox.workingCopyKey),
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

export const installCommand = () =>
  `sh -c 'printf "Pool token: "; stty -echo; read -r SPOTLIGHT_POOL_TOKEN; stty echo; echo; export SPOTLIGHT_POOL_TOKEN; curl -fsSL ${window.location.origin}/api/install.sh | sh'`;

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

export const hostSlotsTip = (host: Host): TooltipNote => {
  const warm = host.idleSandboxes.filter(isWarm).length;

  return {
    rows: [
      ['Runs', String(host.runners.length)],
      ['Warm sandboxes', String(warm)],
      ['Idle sandboxes', String(host.idleSandboxes.length - warm)],
      ['Free', String(host.slotsOffered)],
    ],
  };
};

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

export const imageHarnesses = (
  host: Host,
  image: string | null,
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  namedHarnesses(
    host.images.find((each) => each.image === image)?.harnesses ?? [],
    harnesses,
  );

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

export const PLATFORM_POOL = 'Spotlight pool';

export const PLATFORM_POOL_WITH_EGRESS = `${PLATFORM_POOL} with egress`;

const PLATFORM_POOL_TIP =
  'Spotlight adds this pool to each workspace. Spotlight sends work to this pool only when no other pool or host of this workspace fits the work.';

export const SPOTLIGHT_EGRESS_TIP =
  'The runs of this pool go out through the Spotlight egress. Runs whose secrets egress injects can run here.';

export const platformPoolTip = (egress: boolean): string =>
  egress ? `${PLATFORM_POOL_TIP} ${SPOTLIGHT_EGRESS_TIP}` : PLATFORM_POOL_TIP;

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

const deletedRun = (run: LeasedRun): string =>
  run.kind === 'chat' ? 'Deleted agent chat' : 'Deleted task';

export const formatRun = (run: LeasedRun | null): string => {
  if (run === null) {
    return 'No run yet';
  }

  if (run.title !== null) {
    return run.title;
  }

  if (isUnnamed(run.kind)) {
    return UNNAMED_RUNS[run.kind];
  }

  return run.readable ? deletedRun(run) : hiddenRunTip(run);
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

export const isWarm = (sandbox: IdleSandbox): boolean =>
  sandbox.warmLineId !== null;

export type SandboxRow = {
  readonly id: string;
  readonly sandboxes: readonly [IdleSandbox, ...IdleSandbox[]];
};

export type HostChild =
  | { readonly kind: 'run'; readonly runner: ActiveRunner }
  | { readonly kind: 'sandboxes'; readonly row: SandboxRow };

const STOPPING = 4;

const rankOf = (child: HostChild): number => {
  if (child.kind === 'run') {
    return child.runner.currentRun ? 0 : 1;
  }

  const [first] = child.row.sandboxes;

  if (first.status === 'draining') {
    return STOPPING;
  }

  return isWarm(first) ? 3 : 2;
};

const WARM_STATUS_ORDER: readonly IdleSandbox['status'][] = [
  'starting',
  'ready',
  'draining',
];

const warmRows = (warm: readonly IdleSandbox[]): SandboxRow[] => {
  const lines = [...new Set(warm.map((each) => each.warmLineId))];
  const groups = new Map<string, [IdleSandbox, ...IdleSandbox[]]>();

  for (const sandbox of warm) {
    const key = [sandbox.warmLineId, sandbox.status, sandbox.image].join('\n');
    const group = groups.get(key);

    if (group) {
      group.push(sandbox);
    } else {
      groups.set(key, [sandbox]);
    }
  }

  const byLineThenStatus = (one: SandboxRow, other: SandboxRow): number => {
    const [a] = one.sandboxes;
    const [b] = other.sandboxes;

    return (
      lines.indexOf(a.warmLineId) - lines.indexOf(b.warmLineId) ||
      WARM_STATUS_ORDER.indexOf(a.status) - WARM_STATUS_ORDER.indexOf(b.status)
    );
  };

  return [...groups.values()]
    .map((sandboxes) => ({ id: sandboxes[0].id, sandboxes }))
    .sort(byLineThenStatus);
};

export const hostChildren = (host: Host): HostChild[] =>
  [
    ...host.runners.map((runner): HostChild => ({ kind: 'run', runner })),
    ...host.idleSandboxes
      .filter((each) => !isWarm(each))
      .map((sandbox): HostChild => ({
        kind: 'sandboxes',
        row: { id: sandbox.id, sandboxes: [sandbox] },
      })),
    ...warmRows(host.idleSandboxes.filter(isWarm)).map((row): HostChild => ({
      kind: 'sandboxes',
      row,
    })),
  ].sort((one, other) => rankOf(one) - rankOf(other));

const oldestOf = (row: SandboxRow): IdleSandbox =>
  row.sandboxes.reduce((oldest, each) =>
    each.startedAt < oldest.startedAt ? each : oldest,
  );

export const warmSandboxLabel = (
  count: number,
  lineName: string | undefined,
): string => {
  const what = count === 1 ? 'Warm sandbox' : `${count} warm sandboxes`;

  return lineName ? `${what} for ${lineName}` : what;
};

export const idleSandboxLabel = (sandbox: IdleSandbox): string =>
  sandbox.lastRun ? formatRun(sandbox.lastRun) : 'Idle sandbox';

const SANDBOX_STATUSES: Record<
  IdleSandbox['status'],
  { warm: string; task: string }
> = {
  starting: { warm: 'Starting', task: 'Starting' },
  ready: { warm: 'Ready', task: 'Idle' },
  draining: { warm: 'Stopping', task: 'Stopping' },
};

export const sandboxStatus = (sandbox: IdleSandbox): string =>
  SANDBOX_STATUSES[sandbox.status][isWarm(sandbox) ? 'warm' : 'task'];

export const sandboxStatusTip = (
  sandbox: IdleSandbox,
  lineName: string | undefined,
): string | null => {
  if (sandbox.status === 'draining') {
    return 'Spotlight stops this sandbox. Its slot is free when it stops.';
  }

  if (sandbox.status !== 'ready') {
    return null;
  }

  return isWarm(sandbox)
    ? `Sandbox has ${lineName ? `${lineName}’s` : 'this line’s'} repositories set up. It takes the first run of a task on this line.`
    : 'Sandbox holds this task’s workspace for its next run.';
};

export const sandboxActivity = (row: SandboxRow): string => {
  const [first] = row.sandboxes;

  return isWarm(first)
    ? `Started ${since(oldestOf(row).startedAt)}`
    : `Idle since ${since(first.idleSince)}`;
};

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
