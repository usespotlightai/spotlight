import { WatchHostOutages } from '@runners/application/services/watch-host-outages.service';
import type { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import {
  aPullPool,
  storedHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { HostOutageVersionConflictError } from '@runners/domain/exceptions/host-outage-version-conflict.error';
import type { HostOutageRepository } from '@runners/domain/repositories/host-outage.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import {
  aNamedHost,
  minutesAfter,
} from '@runners/domain/services/host-outages.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

class InMemoryOutages implements HostOutageRepository {
  readonly open = new Map<string, HostOutage>();
  readonly events: DomainEvent[] = [];

  add = async (outage: HostOutage) => {
    if (
      [...this.open.values()].some((each) => each.source.equals(outage.source))
    ) {
      throw new HostOutageVersionConflictError(outage.source.id);
    }
    this.open.set(outage.id.value, outage);
    this.events.push(...outage.pullEvents());
  };

  remove = async (outage: HostOutage) => {
    if (!this.open.delete(outage.id.value)) {
      throw new HostOutageVersionConflictError(outage.source.id);
    }
    this.events.push(...outage.pullEvents());
  };

  all = async () => [...this.open.values()];
}

const watching = (
  ...known: RunnerHost[]
): {
  readonly sweepAt: (minutes: number) => Promise<string[]>;
  readonly hosts: ReturnType<typeof storedHosts>;
  readonly outages: InMemoryOutages;
  workWaits: boolean;
} => {
  const hosts = storedHosts(...known);
  const outages = new InMemoryOutages();
  let at = minutesAfter(0);
  let ids = 0;
  const state = {
    hosts,
    outages,
    workWaits: false,
    sweepAt: async (minutes: number) => {
      at = minutesAfter(minutes);
      const before = outages.events.length;

      await new WatchHostOutages(
        outages,
        hosts.hosts,
        partial<RunnerPoolRepository>({
          find: async () => aPullPool(),
        }),
        partial<RunnerTrustRepository>({ find: async () => null }),
        { waitsIn: async () => state.workWaits },
        { generate: () => `outage_${++ids}` },
        { now: () => at, sleep: async () => {} },
      ).sweep();

      return outages.events.slice(before).map((each) => each.kind);
    },
  };

  return state;
};

describe('WatchHostOutages', () => {
  it('raises an outage at once when the only host goes offline while work waits, and only once', async () => {
    const watch = watching(aNamedHost('dev-host'));
    watch.workWaits = true;

    expect(await watch.sweepAt(1)).toEqual([]);
    expect(await watch.sweepAt(2)).toEqual(['host-outage.began']);
    expect(await watch.sweepAt(3)).toEqual([]);
    expect(await watch.sweepAt(30)).toEqual([]);
    expect(watch.outages.open.size).toBe(1);
  });

  it('waits a few minutes before it raises an outage while no work waits', async () => {
    const watch = watching(aNamedHost('dev-host'));

    expect(await watch.sweepAt(2)).toEqual([]);
    expect(await watch.sweepAt(4)).toEqual([]);
    expect(await watch.sweepAt(5)).toEqual(['host-outage.began']);
  });

  it('names the pool and its quiet hosts in the outage', async () => {
    const watch = watching(aNamedHost('dev-host'));

    await watch.sweepAt(10);

    expect(watch.outages.events).toEqual([
      expect.objectContaining({
        kind: 'host-outage.began',
        sourceKey: 'ephemeral',
        hosts: ['dev-host'],
        since: minutesAfter(0),
      }),
    ]);
  });

  it('ends the outage once a host comes back, and raises a new one when it goes again', async () => {
    const watch = watching(aNamedHost('dev-host'));

    expect(await watch.sweepAt(10)).toEqual(['host-outage.began']);

    watch.hosts.stored.clear();
    watch.hosts.stored.set('back', aNamedHost('dev-host', { lastAt: 20 }));

    expect(await watch.sweepAt(20)).toEqual(['host-outage.ended']);
    expect(await watch.sweepAt(21)).toEqual([]);
    expect(await watch.sweepAt(30)).toEqual(['host-outage.began']);
  });

  it('raises nothing while another host of the pool reports in', async () => {
    const watch = watching(
      aNamedHost('dev-host'),
      aNamedHost('spare-host', { lastAt: 30 }),
    );
    watch.workWaits = true;

    expect(await watch.sweepAt(30)).toEqual([]);
  });

  it('ends the outage once the pool has no host left', async () => {
    const watch = watching(aNamedHost('dev-host'));

    await watch.sweepAt(10);
    watch.hosts.stored.clear();

    expect(await watch.sweepAt(11)).toEqual(['host-outage.ended']);
    expect(watch.outages.open.size).toBe(0);
  });
});
