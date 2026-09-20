import type {
  ConnectedRunnerResponseDto,
  HeldRunResponseDto,
  RunnerActivityResponseDto,
} from '@/lib/api';

export type Runner = ConnectedRunnerResponseDto & {
  readonly currentRun: HeldRunResponseDto | null;
};

export const withActivity = (
  runners: readonly ConnectedRunnerResponseDto[],
  activity: readonly RunnerActivityResponseDto[],
): Runner[] =>
  runners.map((runner) => ({
    ...runner,
    currentRun:
      activity.find((each) => each.runnerId === runner.id)?.currentRun ?? null,
  }));

export const runnersPath = (slug: string) => `/w/${slug}/runners`;

const isReachable = (runner: Runner) => runner.connected;

export const reachableCount = (runners: readonly Runner[]) =>
  runners.filter(isReachable).length;

export const standing = (runner: Runner): string => {
  if (runner.revokedAt) {
    return 'Revoked';
  }
  if (!runner.lastSeenAt) {
    return 'Never connected';
  }
  if (!runner.connected) {
    return 'Not answering';
  }

  return runner.currentRun ? 'Running' : 'Idle';
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

export const seenAt = (runner: Runner): string =>
  runner.lastSeenAt
    ? `Last seen ${since(runner.lastSeenAt)}`
    : `Registered ${since(runner.registeredAt)}`;

export type NamedHarness = {
  readonly id: string;
  readonly name: string;
};

export const harnessesOf = (
  runner: Runner,
  harnesses: readonly NamedHarness[] | undefined,
): NamedHarness[] =>
  runner.harnesses.map((id) => ({
    id,
    name: harnesses?.find((harness) => harness.id === id)?.name ?? id,
  }));
