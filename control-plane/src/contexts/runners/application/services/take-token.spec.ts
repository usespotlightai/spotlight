import type { UsedTokensPort } from '@runners/application/ports/used-tokens.port';
import {
  type TokenHolderLookup,
  takeToken,
} from '@runners/application/services/take-token';
import {
  hashOf,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import { TokenHolder } from '@runners/domain/value-objects/token-holder.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { describe, expect, it, vi } from 'vitest';

const ledger = () => {
  const kept = new Map<string, TokenHolder>();
  const usedTokens = {
    wasUsed: vi.fn(async (kind, token: TokenHash) =>
      kept.has(`${kind}:${token.value}`),
    ),
    record: vi.fn(async (token: TokenHash, holder: TokenHolder) => {
      const key = `${holder.kind}:${token.value}`;

      if (kept.has(key)) {
        return false;
      }

      kept.set(key, holder);

      return true;
    }),
  } satisfies UsedTokensPort;

  return { usedTokens, kept };
};

const nobody: TokenHolderLookup = async () => null;

describe('takeToken', () => {
  const pool = TokenHolder.pool(POOL_ID);
  const otherPool = TokenHolder.pool(PoolId.of('pool_2'));
  const egress = TokenHolder.egress(EgressId.of('egress_1'));

  it('records a token never used before for its holder', async () => {
    const { usedTokens, kept } = ledger();

    await takeToken(usedTokens, nobody, pool, hashOf('a'));

    expect(kept.get(`pool:${hashOf('a').value}`)?.equals(pool)).toBe(true);
  });

  it('records nothing when no token is taken', async () => {
    const { usedTokens } = ledger();

    await takeToken(usedTokens, nobody, pool, null);

    expect(usedTokens.wasUsed).not.toHaveBeenCalled();
    expect(usedTokens.record).not.toHaveBeenCalled();
  });

  it('rejects a token another pool holds as in use, and records nothing', async () => {
    const { usedTokens } = ledger();
    await takeToken(usedTokens, nobody, otherPool, hashOf('a'));
    usedTokens.record.mockClear();

    await expect(
      takeToken(usedTokens, async () => otherPool, pool, hashOf('a')),
    ).rejects.toThrow(PoolTokenInUseError);
    expect(usedTokens.record).not.toHaveBeenCalled();
  });

  it('rejects a token used once before as already used, the holder’s own old token too', async () => {
    const { usedTokens } = ledger();
    await takeToken(usedTokens, nobody, pool, hashOf('a'));

    await expect(
      takeToken(usedTokens, nobody, otherPool, hashOf('a')),
    ).rejects.toThrow(PoolTokenAlreadyUsedError);
    await expect(
      takeToken(usedTokens, nobody, pool, hashOf('a')),
    ).rejects.toThrow(PoolTokenAlreadyUsedError);
  });

  it('counts the holder itself as no other holder', async () => {
    const { usedTokens } = ledger();

    await takeToken(usedTokens, async () => pool, pool, hashOf('a'));

    expect(usedTokens.record).toHaveBeenCalledWith(hashOf('a'), pool);
  });

  it('keeps pool and egress tokens apart: an egress may take a token a pool used', async () => {
    const { usedTokens } = ledger();
    await takeToken(usedTokens, nobody, pool, hashOf('a'));

    await expect(
      takeToken(usedTokens, nobody, egress, hashOf('a')),
    ).resolves.toBeUndefined();
    await expect(
      takeToken(
        usedTokens,
        nobody,
        TokenHolder.egress(EgressId.of('egress_2')),
        hashOf('a'),
      ),
    ).rejects.toThrow(EgressTokenAlreadyUsedError);
  });

  it('rejects a token the ledger refuses after the check, as another holder took it at the same time', async () => {
    const { usedTokens } = ledger();
    usedTokens.record.mockResolvedValueOnce(false);

    await expect(
      takeToken(usedTokens, nobody, pool, hashOf('a')),
    ).rejects.toThrow(PoolTokenInUseError);
  });
});
