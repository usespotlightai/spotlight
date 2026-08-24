import type { ConnectedRunnerResponseDto } from '@/lib/api';

export type Runner = ConnectedRunnerResponseDto;

export const AGENT_COMMAND = { executable: 'claude' } as const;

export const runnersPath = (slug: string) => `/w/${slug}/runners`;

export const runnerTerminalPath = (slug: string, runnerId: string) =>
  `/w/${slug}/runners/${runnerId}`;

export const shortRunnerId = (id: string) => id.slice(0, 8);

export function byPool(runners: readonly Runner[]): [string, Runner[]][] {
  const pools = new Map<string, Runner[]>();

  for (const runner of runners) {
    pools.set(runner.pool, [...(pools.get(runner.pool) ?? []), runner]);
  }

  return [...pools].sort(([one], [other]) => one.localeCompare(other));
}
