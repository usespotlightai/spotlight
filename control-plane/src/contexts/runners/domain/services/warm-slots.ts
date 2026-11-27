import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import type { HostSlotHolders } from '@runners/domain/services/host-slot-holders';

const oldestFirst = (a: Sandbox, b: Sandbox): number =>
  a.startedAt.getTime() - b.startedAt.getTime() ||
  (a.id.value < b.id.value ? -1 : a.id.value > b.id.value ? 1 : 0);

const longestIdleFirst = (a: Sandbox, b: Sandbox): number =>
  (a.idleSince?.getTime() ?? 0) - (b.idleSince?.getTime() ?? 0) ||
  oldestFirst(a, b);

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
        .sort(oldestFirst)[0] ??
      onHost
        .filter((each) => each.waitsForFollowUpOn(host, now))
        .sort(longestIdleFirst)[0] ??
      null
    );
  },
};
