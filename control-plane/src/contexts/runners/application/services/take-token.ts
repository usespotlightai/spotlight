import type { UsedTokensPort } from '@runners/application/ports/used-tokens.port';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { assertTokenFree } from '@runners/domain/services/token-reuse';
import { TokenHolder } from '@runners/domain/value-objects/token-holder.vo';
import { TokenUsage } from '@runners/domain/value-objects/token-usage.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export type TokenHolderLookup = (
  token: TokenHash,
) => Promise<TokenHolder | null>;

export const poolTokenHolders =
  (pools: RunnerPoolRepository): TokenHolderLookup =>
  async (token) => {
    const pool = await pools.findByTokenHash(token);

    return pool ? TokenHolder.pool(pool.id) : null;
  };

export const egressTokenHolders =
  (egresses: EgressRepository): TokenHolderLookup =>
  async (token) => {
    const egress = await egresses.findByTokenHash(token);

    return egress ? TokenHolder.egress(egress.id) : null;
  };

export const takeToken = async (
  usedTokens: UsedTokensPort,
  holderOf: TokenHolderLookup,
  holder: TokenHolder,
  token: TokenHash | null,
): Promise<void> => {
  if (!token) {
    return;
  }

  const used = await usedTokens.wasUsed(holder.kind, token);
  // Read the holder after the ledger: a holder saved with its ledger row is then always visible.
  const current = await holderOf(token);

  assertTokenFree(
    holder,
    TokenUsage.of({
      used,
      heldByAnother: current !== null && !current.equals(holder),
    }),
  );

  if (!(await usedTokens.record(token, holder))) {
    assertTokenFree(holder, TokenUsage.takenConcurrently());
  }
};
