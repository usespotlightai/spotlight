import { RunnerReadiness } from '@runners/application/services/runner-readiness.service';
import type { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aHost,
  aPlatformPool,
  aPushPool,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
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
  const pools = {
    inWorkspace: vi.fn(async () => input.pools ?? []),
  } as unknown as RunnerPoolRepository;
  const hosts = {
    inWorkspace: vi.fn(async () => input.hosts ?? []),
  } as unknown as RunnerHostRepository;

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
});
