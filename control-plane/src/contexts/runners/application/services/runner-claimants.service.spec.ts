import { RunnerClaimants } from '@runners/application/services/runner-claimants.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPlatformPool,
  aPullPool,
  aRunner,
  aTrust,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = RunnerId.of('pooled_1');

const SOON = new Date(STARTED_AT.getTime() + 1_000);

const claimants = (
  runner: Runner | null,
  known: { pool?: RunnerPool | null; trust?: RunnerTrust | null } = {},
) =>
  new RunnerClaimants(
    { find: vi.fn(async () => runner) } as unknown as RunnerRepository,
    {
      find: vi.fn(async () => known.pool ?? null),
    } as unknown as RunnerPoolRepository,
    {
      find: vi.fn(async () => known.trust ?? null),
    } as unknown as RunnerTrustRepository,
  );

describe('RunnerClaimants', () => {
  it('names the pool a runner came in through by its key', async () => {
    const pool = aPullPool();

    const found = await claimants(aRunner({ through: pool }), {
      pool,
    }).registeredClaimantOf(ID, SOON);

    expect(found?.source).toEqual({
      kind: 'pool',
      key: 'ephemeral',
      platform: false,
    });
  });

  it('names the platform pool as the platform pool', async () => {
    const pool = aPlatformPool();

    const found = await claimants(aRunner({ through: pool, host: null }), {
      pool,
    }).registeredClaimantOf(ID, SOON);

    expect(found?.source).toEqual({
      kind: 'pool',
      key: 'spotlight',
      platform: true,
    });
  });

  it('names the trust a runner came in through by its key', async () => {
    const trust = aTrust();

    const found = await claimants(aRunner({ through: trust }), {
      trust,
    }).registeredClaimantOf(ID, SOON);

    expect(found?.source).toEqual({
      kind: 'trust',
      key: 'cluster',
      platform: false,
    });
  });

  it('names no source once the pool of the runner is gone', async () => {
    const found = await claimants(aRunner()).registeredClaimantOf(ID, SOON);

    expect(found?.claims).toBe('reserved');
    expect(found?.source).toBeNull();
  });

  it('finds no claimant for a runner that is not alive', async () => {
    expect(await claimants(null).claimantOf(ID, SOON)).toBeNull();
    expect(await claimants(null).registeredClaimantOf(ID, SOON)).toBeNull();
  });

  it('reads no pool and no trust for a claimant on the hot routes, such as a lease renewal', async () => {
    const pools = { find: vi.fn(async () => aPullPool()) };
    const trusts = { find: vi.fn(async () => aTrust()) };
    const found = await new RunnerClaimants(
      { find: vi.fn(async () => aRunner()) } as unknown as RunnerRepository,
      pools as unknown as RunnerPoolRepository,
      trusts as unknown as RunnerTrustRepository,
    ).claimantOf(ID, SOON);

    expect(found).not.toHaveProperty('source');
    expect(pools.find).not.toHaveBeenCalled();
    expect(trusts.find).not.toHaveBeenCalled();
  });
});
