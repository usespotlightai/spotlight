import { givePoolToken } from '@runners/application/services/give-pool-token';
import {
  aPullPool,
  aPushPool,
  hashOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import type { GivenPoolTokensRepository } from '@runners/domain/repositories/given-pool-tokens.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { describe, expect, it, vi } from 'vitest';

const giving = (ledger: { given?: boolean; inUse?: boolean } = {}) => {
  const given = {
    wasGiven: vi.fn(async () => ledger.given ?? false),
    give: vi.fn(async () => {}),
  } satisfies GivenPoolTokensRepository;
  const pools = {
    findByTokenHash: vi.fn(async () =>
      ledger.inUse ? aPullPool({ id: RunnerPoolId.of('pool_other') }) : null,
    ),
  } as unknown as RunnerPoolRepository;

  return { given, pools };
};

describe('givePoolToken', () => {
  it('records a token never given before as given to the pool', async () => {
    const { given, pools } = giving();
    const pool = aPullPool();

    await givePoolToken(given, pools, pool, null);

    expect(given.give).toHaveBeenCalledWith(hashOf('a'), pool.id);
  });

  it('refuses a token another pool uses as taken, and records nothing', async () => {
    const { given, pools } = giving({ given: true, inUse: true });

    await expect(
      givePoolToken(given, pools, aPullPool(), null),
    ).rejects.toThrow(PoolTokenTakenError);
    expect(given.give).not.toHaveBeenCalled();
  });

  it('refuses a token given once before as spent, and records nothing', async () => {
    const { given, pools } = giving({ given: true });

    await expect(
      givePoolToken(given, pools, aPullPool(), null),
    ).rejects.toThrow(PoolTokenSpentError);
    expect(given.give).not.toHaveBeenCalled();
  });

  it('counts the pool itself, already saved, as no other holder', async () => {
    const { given } = giving();
    const pool = aPullPool();
    const pools = {
      findByTokenHash: vi.fn(async () => pool),
    } as unknown as RunnerPoolRepository;

    await givePoolToken(given, pools, pool, null);

    expect(given.give).toHaveBeenCalledWith(hashOf('a'), pool.id);
  });

  it('gives nothing when the pool keeps its token or provisions', async () => {
    const { given, pools } = giving({ given: true, inUse: true });
    const pool = aPullPool();

    await givePoolToken(given, pools, pool, pool);
    await givePoolToken(given, pools, aPushPool(), null);

    expect(given.wasGiven).not.toHaveBeenCalled();
    expect(given.give).not.toHaveBeenCalled();
  });
});
