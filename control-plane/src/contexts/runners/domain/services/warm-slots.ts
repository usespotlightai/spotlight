import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { HostSlotHolders } from '@runners/domain/services/host-slot-holders';

const oldestFirst = (a: Sandbox, b: Sandbox): number =>
  a.startedAt.getTime() - b.startedAt.getTime() ||
  (a.id.value < b.id.value ? -1 : a.id.value > b.id.value ? 1 : 0);

export const WarmSlots = {
  roomForWarm(host: RunnerHost, holders: HostSlotHolders): boolean {
    return host.hasFreeSlot(holders.taken + 1);
  },

  toDrainForQueuedRun(
    host: RunnerHost,
    holders: HostSlotHolders,
    onHost: readonly Sandbox[],
    now: Date,
  ): Sandbox | null {
    if (
      host.hasFreeSlot(holders.taken) ||
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
