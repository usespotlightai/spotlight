import type { ConnectedRunnerResponseDto } from '@/lib/api';

export type Runner = ConnectedRunnerResponseDto;

export const runnersPath = (slug: string) => `/w/${slug}/runners`;

export const shortRunnerId = (id: string) => id.slice(0, 8);

export const isReachable = (runner: Runner) => runner.connected;

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
