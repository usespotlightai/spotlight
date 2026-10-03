import type {
  AdmittedThroughResponseDto,
  HeldRunResponseDto,
  HostHarnessResponseDto,
  HostResponseDto,
  LiveRunnerResponseDto,
  RunnerActivityResponseDto,
  RunnerFleetResponseDto,
} from '@/lib/api';
import { settingsPath } from '@/lib/settings';

export type Host = HostResponseDto & {
  readonly runs: readonly HeldRunResponseDto[];
};

export type ProvisionedRunner = LiveRunnerResponseDto & {
  readonly currentRun: HeldRunResponseDto | null;
};

export type Fleet = {
  readonly hosts: readonly Host[];
  readonly provisioned: readonly ProvisionedRunner[];
};

export const withActivity = (
  fleet: RunnerFleetResponseDto,
  activity: readonly RunnerActivityResponseDto[],
): Fleet => {
  const runOf = (runnerId: string) =>
    activity.find((each) => each.runnerId === runnerId)?.currentRun ?? null;

  return {
    hosts: fleet.hosts.map((host) => ({
      ...host,
      runs: host.running.flatMap((runner) => {
        const run = runOf(runner);
        return run ? [run] : [];
      }),
    })),
    provisioned: fleet.runners
      .filter((runner) => runner.hostId === null)
      .map((runner) => ({ ...runner, currentRun: runOf(runner.id) })),
  };
};

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

export const namedHarnesses = (
  reported: readonly HostHarnessResponseDto[],
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  reported.map((each) => ({
    id: each.id,
    name: nameOf(each.id, harnesses),
    version: each.version,
  }));

export const refusal = (reason: string): string =>
  `Refused: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`;

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

export const provisionedInFilter = (
  filter: RunnerFilter,
  runner: ProvisionedRunner,
): boolean =>
  filter === 'all' || (filter === 'running' && runner.currentRun !== null);

export const NONE_IN_FILTER: Record<Exclude<RunnerFilter, 'all'>, string> = {
  running: 'No runner is running a run.',
  idle: 'No host is idle.',
  'not-answering': 'Every host is answering.',
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
