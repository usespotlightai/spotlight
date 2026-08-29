import type { ConnectedRunnerResponseDto } from '@/lib/api';

export type Runner = ConnectedRunnerResponseDto;

export const runnersPath = (slug: string) => `/w/${slug}/runners`;

export const shortRunnerId = (id: string) => id.slice(0, 8);

export const isReachable = (runner: Runner) => runner.connected;

export const reachableCount = (runners: readonly Runner[]) =>
  runners.filter(isReachable).length;

/** What a runner is doing, in the words a person would use for it. */
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
