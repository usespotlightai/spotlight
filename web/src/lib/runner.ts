import type {
  AdmittedThroughResponseDto,
  HeldRunResponseDto,
  HostHarnessResponseDto,
  HostResponseDto,
  LiveRunnerResponseDto,
  RunnerActivityResponseDto,
  RunnerFleetResponseDto,
} from '@/lib/api';
import { runPath } from '@/lib/run';
import { settingsPath } from '@/lib/settings';

export type HeldRun = HeldRunResponseDto;

export type ActiveRunner = LiveRunnerResponseDto & {
  readonly currentRun: HeldRun | null;
};

export type Host = HostResponseDto & {
  readonly runners: readonly ActiveRunner[];
};

export type PushPool = {
  readonly through: AdmittedThroughResponseDto;
  readonly runners: readonly ActiveRunner[];
};

export type Fleet = {
  readonly hosts: readonly Host[];
  readonly pools: readonly PushPool[];
};

export const poolKeyOf = (way: AdmittedThroughResponseDto): string =>
  `${way.kind}:${way.key ?? ''}`;

export const withActivity = (
  fleet: RunnerFleetResponseDto,
  activity: readonly RunnerActivityResponseDto[],
): Fleet => {
  const runners: ActiveRunner[] = fleet.runners.map((runner) => ({
    ...runner,
    currentRun:
      activity.find((each) => each.runnerId === runner.id)?.currentRun ?? null,
  }));
  const unhosted = runners.filter((runner) => runner.hostId === null);
  const pools = [
    ...new Set(unhosted.map((runner) => poolKeyOf(runner.through))),
  ];

  return {
    hosts: fleet.hosts.map((host) => ({
      ...host,
      runners: runners.filter((runner) => runner.hostId === host.id),
    })),
    pools: pools.flatMap((key) => {
      const held = unhosted.filter(
        (runner) => poolKeyOf(runner.through) === key,
      );
      const first = held[0];

      return first ? [{ through: first.through, runners: held }] : [];
    }),
  };
};

export const imageShortName = (image: string): string =>
  image.slice(image.lastIndexOf('/') + 1);

export const runnersPath = (slug: string) => `${settingsPath(slug)}/runners`;

export const addHostPath = (slug: string) => `${runnersPath(slug)}/new`;

export const installCommand = (token: string) =>
  `curl -fsSL ${window.location.origin}/api/install.sh | SPOTLIGHT_TOKEN=${token} sh`;

export const answeringCount = (fleet: Fleet) =>
  fleet.hosts.filter((host) => host.answering).length;

export const noneAnswering = (fleet: Fleet): boolean =>
  fleet.hosts.length > 0 && answeringCount(fleet) === 0;

export const standing = (host: Host): string => {
  if (!host.answering) {
    return 'Not answering';
  }

  return host.running.length > 0
    ? `Running ${host.running.length} of ${host.capacity}`
    : 'Idle';
};

export const through = (way: AdmittedThroughResponseDto): string => {
  const kind = way.kind === 'pool' ? 'Pool' : 'Trust';
  return way.key === null ? `${kind} no longer defined` : `${kind} ${way.key}`;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const since = (at: string): string => {
  const ago = Date.now() - new Date(at).getTime();

  if (ago < MINUTE) {
    return 'just now';
  }
  if (ago < HOUR) {
    return `${Math.floor(ago / MINUTE)}m ago`;
  }
  if (ago < DAY) {
    return `${Math.floor(ago / HOUR)}h ago`;
  }

  return new Date(at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

export const seenAt = (host: Host): string =>
  host.answering
    ? `Up since ${since(host.upSince)}`
    : `Last seen ${since(host.lastSeenAt)}`;

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
      .filter((image) => !image.refused)
      .flatMap((image) => image.harnesses)
      .filter(
        (each, at, all) =>
          all.findIndex((other) => other.id === each.id) === at,
      ),
    harnesses,
  );

export const heldBy = (
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
  { id: 'not-answering', label: 'Not answering' },
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
      return host.answering && host.running.length > 0;
    case 'idle':
      return host.answering && host.running.length === 0;
    case 'not-answering':
      return !host.answering;
  }
};

export const poolInFilter = (filter: RunnerFilter, pool: PushPool): boolean =>
  filter === 'all' ||
  (filter === 'running' &&
    pool.runners.some((runner) => runner.currentRun !== null));

export const poolName = (way: AdmittedThroughResponseDto): string =>
  way.key ?? 'No longer defined';

export const PUSH_POOL = 'Push pool';

export const poolStanding = (pool: PushPool): string => {
  const running = pool.runners.filter(
    (runner) => runner.currentRun !== null,
  ).length;

  return running > 0 ? `Running ${running}` : 'Starting';
};

export const runnerStanding = (runner: ActiveRunner): string => {
  if (!runner.currentRun) {
    return 'Starting';
  }

  return runner.currentRun.state === 'waiting'
    ? 'Waiting on a person'
    : 'Running';
};

type UnnamedKind = Exclude<HeldRun['kind'], 'task' | 'chat'>;

const UNNAMED_RUNS: Record<UnnamedKind, string> = {
  replay: 'A replay run',
  search: 'A search run',
  spec: 'A run queued by hand',
};

const isUnnamed = (kind: HeldRun['kind']): kind is UnnamedKind =>
  kind in UNNAMED_RUNS;

export const hiddenRunTip = (run: HeldRun): string =>
  run.kind === 'chat'
    ? 'Title hidden. This agent chat belongs to a team you’re not on.'
    : 'Title hidden. This run belongs to a team you’re not on.';

export const runShown = (run: HeldRun | null): string => {
  if (run === null) {
    return 'No run yet';
  }

  return (
    run.title ??
    (isUnnamed(run.kind) ? UNNAMED_RUNS[run.kind] : hiddenRunTip(run))
  );
};

export const hiddenFromViewer = (run: HeldRun | null): boolean =>
  run !== null &&
  !run.readable &&
  run.teamId !== null &&
  (run.kind === 'task' || run.kind === 'chat');

export const heldRunPath = (
  slug: string,
  run: HeldRun | null,
): string | null =>
  run?.kind === 'task' && run.readable && run.teamId !== null
    ? runPath(slug, run.teamId, run.id)
    : null;

export const NONE_IN_FILTER: Record<Exclude<RunnerFilter, 'all'>, string> = {
  running: 'No runs in progress.',
  idle: 'No idle hosts.',
  'not-answering': 'All hosts are answering.',
};

export const connectedIn = (
  fleet: Fleet | undefined,
  pool: string,
): Host | undefined =>
  fleet?.hosts.find(
    (host) =>
      host.answering &&
      host.through.kind === 'pool' &&
      host.through.key === pool,
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
