import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';

const oldestFirst = (a: Sandbox, b: Sandbox): number =>
  a.startedAt.getTime() - b.startedAt.getTime() ||
  (a.id.value < b.id.value ? -1 : a.id.value > b.id.value ? 1 : 0);

export const WarmSlots = {
  roomForWarm(host: RunnerHost, withTheClaim: PoolOccupancy): boolean {
    return host.hasFreeSlot(withTheClaim.taken);
  },

  toDrainForQueuedRun(
    host: RunnerHost,
    occupancy: PoolOccupancy,
    openClaims: number,
    onHost: readonly Sandbox[],
    now: Date,
  ): Sandbox | null {
    if (
      host.hasFreeSlot(occupancy.taken - openClaims) ||
      onHost.some((each) => each.current === 'draining')
    ) {
      return null;
    }

    return (
      onHost
        .filter((each) => each.takesFirstRunOn(host, now))
        .sort(oldestFirst)[0] ?? null
    );
  },
};
