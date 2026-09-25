import type {
  AdmittedThroughResponseDto,
  HeldRunResponseDto,
  HostResponseDto,
  LiveRunnerResponseDto,
  RunnerActivityResponseDto,
  RunnerFleetResponseDto,
} from '@/lib/api';

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

export const runnersPath = (slug: string) => `/w/${slug}/runners`;

export const answeringCount = (fleet: Fleet) =>
  fleet.hosts.filter((host) => host.answering).length;

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
    ? `Up since ${since(host.firstSeenAt)}`
    : `Last seen ${since(host.lastSeenAt)}`;

export type NamedHarness = {
  readonly id: string;
  readonly name: string;
};

export const harnessesOf = (
  ids: readonly string[],
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  ids.map((id) => ({
    id,
    name: harnesses?.find((harness) => harness.id === id)?.name ?? id,
  }));
