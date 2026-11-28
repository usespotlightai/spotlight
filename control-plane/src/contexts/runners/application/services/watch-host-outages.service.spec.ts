import { WatchHostOutages } from '@runners/application/services/watch-host-outages.service';
import type { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
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
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type {
  LogFields,
  LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { describe, expect, it, vi } from 'vitest';

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

  ofSource = async (source: CredentialSource) =>
    [...this.open.values()].find((each) => each.source.equals(source)) ?? null;
}

const watching = (...known: RunnerHost[]) => {
  const hosts = storedHosts(...known);
  const outages = new InMemoryOutages();
  const errors: unknown[] = [];
  const asked: (readonly string[])[] = [];
  let reads = 0;
  const state: {
    workWaits: boolean;
    pool: RunnerPool | null;
    otherPools: RunnerPool[];
  } = { workWaits: false, pool: aPullPool(), otherPools: [] };
  let at = minutesAfter(0);
  let ids = 0;

  const sweepAt = async (minutes: number): Promise<string[]> => {
    at = minutesAfter(minutes);
    const before = outages.events.length;

    await new WatchHostOutages(
      outages,
      hosts.hosts,
      partial<RunnerPoolRepository>({
        find: async (id) =>
          [state.pool, ...state.otherPools].find((each) =>
            each?.id.equals(id),
          ) ?? null,
      }),
      partial<RunnerTrustRepository>({ find: async () => null }),
      {
        waitingIn: async () => {
          reads += 1;
          return {
            couldBeTakenWith: (labels) => {
              asked.push(labels);
              return state.workWaits;
            },
          };
        },
      },
      { generate: () => `outage_${++ids}` },
      { now: () => at, sleep: async () => {} },
      partial<LoggerPort>({
        error: vi.fn((fields: LogFields) => {
          errors.push(fields.err);
        }),
      }),
    ).sweep();

    return outages.events.slice(before).map((each) => each.kind);
  };

  return {
    sweepAt,
    hosts,
    outages,
    state,
    errors,
    asked,
    reads: () => reads,
  };
};

describe('WatchHostOutages', () => {
  it('raises an outage two minutes after the only host goes quiet while work waits that it could take, and only once', async () => {
    const watch = watching(aNamedHost('dev-host'));
    watch.state.workWaits = true;

    expect(await watch.sweepAt(1)).toEqual([]);
    expect(await watch.sweepAt(2)).toEqual(['host-outage.began']);
    expect(await watch.sweepAt(3)).toEqual([]);
    expect(await watch.sweepAt(30)).toEqual([]);
    expect(watch.outages.open.size).toBe(1);
    expect(watch.asked).toEqual([['linux']]);
    expect(watch.reads()).toBe(1);
  });

  it('reads the queue once per workspace for all its quiet pools, and only while it decides whether a person hears of them', async () => {
    const gpuPool = aPullPool({ id: PoolId.of('pool_2'), labels: ['gpu'] });
    const watch = watching(
      aNamedHost('dev-host'),
      aNamedHost('gpu-host', { through: gpuPool }),
    );
    watch.state.otherPools = [gpuPool];

    expect(await watch.sweepAt(1)).toEqual([]);
    expect(watch.reads()).toBe(0);

    expect(await watch.sweepAt(2)).toEqual([]);
    expect(await watch.sweepAt(3)).toEqual([]);
    expect(watch.reads()).toBe(2);
    expect(watch.asked).toEqual([['linux'], ['gpu'], ['linux'], ['gpu']]);

    expect(await watch.sweepAt(5)).toEqual([
      'host-outage.began',
      'host-outage.began',
    ]);
    expect(watch.reads()).toBe(2);
  });

  it('waits a few minutes before it raises an outage while no work waits that the hosts could take', async () => {
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

  it('ends the outage once a host comes back, and raises it again when the host goes again', async () => {
    const watch = watching(aNamedHost('dev-host'));

    expect(await watch.sweepAt(10)).toEqual(['host-outage.began']);

    const back = aNamedHost('dev-host', { lastAt: 20 });
    watch.hosts.stored.set(back.id.value, back);

    expect(await watch.sweepAt(20)).toEqual(['host-outage.ended']);
    expect(await watch.sweepAt(21)).toEqual([]);
    expect(await watch.sweepAt(30)).toEqual(['host-outage.began']);
  });

  it('raises nothing while another host of the pool reports in', async () => {
    const watch = watching(
      aNamedHost('dev-host'),
      aNamedHost('spare-host', { lastAt: 30 }),
    );
    watch.state.workWaits = true;

    expect(await watch.sweepAt(30)).toEqual([]);
  });

  it('keeps the outage when Spotlight forgets its hosts after a day, and ends it once the pool is deleted', async () => {
    const watch = watching(aNamedHost('dev-host'));

    await watch.sweepAt(10);
    watch.hosts.stored.clear();

    expect(await watch.sweepAt(60 * 25)).toEqual([]);
    expect(watch.outages.open.size).toBe(1);

    watch.state.pool = aPullPool().delete(changeActorIn());

    expect(await watch.sweepAt(60 * 26)).toEqual(['host-outage.ended']);
    expect(watch.outages.open.size).toBe(0);
  });

  it('raises no outage for a pool that is gone', async () => {
    const watch = watching(aNamedHost('dev-host'));
    watch.state.pool = null;

    expect(await watch.sweepAt(30)).toEqual([]);
  });

  it('logs a workspace that fails and goes on', async () => {
    const watch = watching(aNamedHost('dev-host'));
    watch.hosts.hosts.inWorkspace.mockRejectedValueOnce(new Error('down'));

    await expect(watch.sweepAt(30)).resolves.toEqual([]);
    expect(watch.errors).toEqual([new Error('down')]);
  });
});
