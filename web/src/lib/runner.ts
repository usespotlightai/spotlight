import type { ConnectedRunnerResponseDto } from '@/lib/api';

export type Runner = ConnectedRunnerResponseDto;

export const runnersPath = (slug: string) => `/w/${slug}/runners`;

export const runnerTerminalPath = (slug: string, runnerId: string) =>
  `/w/${slug}/runners/${runnerId}`;

export const shortRunnerId = (id: string) => id.slice(0, 8);

export const isReachable = (runner: Runner) => runner.connected;

export const reachableCount = (runners: readonly Runner[]) =>
  runners.filter(isReachable).length;
