import { RunnerReadiness } from '@runners/application/services/runner-readiness.service';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aHost,
  aPlatformPool,
  aPullPool,
  aPushPool,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import {
  aNamedHost,
  minutesAfter,
} from '@runners/domain/services/host-outages.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const DAY = 24 * 60 * 60_000;

const readiness = (
  input: {
    pools?: RunnerPool[];
    hosts?: RunnerHost[];
    now?: Date;
    platformPoolSet?: boolean;
  } = {},
) => {
  const pools = partial<RunnerPoolRepository>({
    inWorkspace: vi.fn(async () => input.pools ?? []),
  });
  const hosts = partial<RunnerHostRepository>({
    inWorkspace: vi.fn(async () => input.hosts ?? []),
  });

  return {
    pools,
    hosts,
    readiness: new RunnerReadiness(
      pools,
      hosts,
      { now: () => input.now ?? STARTED_AT, sleep: async () => {} },
      {
        platformPoolSet: input.platformPoolSet ?? false,
        platformEgressSet: true,
      },
    ),
  };
};

describe('RunnerReadiness', () => {
  it('asks the domain about the pools and hosts of the workspace', async () => {
    const {
      readiness: ready,
      pools,
      hosts,
    } = readiness({
      pools: [aPushPool()],
    });

    await expect(ready.readyToRun(WORKSPACE)).resolves.toBe(true);
    await expect(ready.hasEgressCapableRunner(WORKSPACE)).resolves.toBe(false);
    expect(pools.inWorkspace).toHaveBeenCalledWith(WORKSPACE);
    expect(hosts.inWorkspace).toHaveBeenCalledWith(WORKSPACE);
  });

  it('loads the hosts only once the pools are in, since a transaction holds one pg client', async () => {
    const { readiness: ready, pools, hosts } = readiness();
    let poolsIn = false;

    vi.mocked(pools.inWorkspace).mockImplementation(async () => {
      await Promise.resolve();
      poolsIn = true;

      return [];
    });
    vi.mocked(hosts.inWorkspace).mockImplementation(async () => {
      expect(poolsIn).toBe(true);

      return [];
    });

    await ready.readyToRun(WORKSPACE);

    expect(hosts.inWorkspace).toHaveBeenCalledOnce();
  });

  it('judges a host by the time now', async () => {
    await expect(
      readiness({ hosts: [aHost()] }).readiness.hasEgressCapableRunner(
        WORKSPACE,
      ),
    ).resolves.toBe(true);
    await expect(
      readiness({
        hosts: [aHost()],
        now: new Date(STARTED_AT.getTime() + DAY),
      }).readiness.readyToRun(WORKSPACE),
    ).resolves.toBe(false);
  });

  it('counts the platform pool only while the deployment sets its provisioner', async () => {
    await expect(
      readiness({ pools: [aPlatformPool()] }).readiness.readyToRun(WORKSPACE),
    ).resolves.toBe(false);
    await expect(
      readiness({
        pools: [aPlatformPool()],
        platformPoolSet: true,
      }).readiness.readyToRun(WORKSPACE),
    ).resolves.toBe(true);
    await expect(
      readiness({ platformPoolSet: true }).readiness.hasPlatformRunners(
        WORKSPACE,
      ),
    ).resolves.toBe(true);
  });

  it('names each harness whose only hosts are offline, with those hosts and when they were last heard from', async () => {
    const host = aNamedHost('dev-host');
    const { readiness: ready } = readiness({
      pools: [aPullPool()],
      hosts: [host],
      now: minutesAfter(30),
    });

    await expect(ready.offlineHarnesses(WORKSPACE)).resolves.toEqual([
      {
        harness: 'claude-code',
        hosts: [{ id: host.id.value, name: 'dev-host' }],
        since: minutesAfter(0),
      },
    ]);
  });

  it('names no harness while its host reports in', async () => {
    const { readiness: ready } = readiness({
      pools: [aPullPool()],
      hosts: [aNamedHost('dev-host')],
      now: minutesAfter(1),
    });

    await expect(ready.offlineHarnesses(WORKSPACE)).resolves.toEqual([]);
  });
});
