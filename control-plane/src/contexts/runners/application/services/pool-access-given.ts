import type { CompiledPoolAccess } from '@runners/application/ports/runner-definitions.port';
import type { GivenAccess } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export const givenAccess = (
  access: CompiledPoolAccess,
  tokens: TokenMintPort,
): GivenAccess =>
  access.mode === 'pull'
    ? {
        mode: 'pull',
        tokenHash: access.token
          ? TokenHash.of(tokens.hash(access.token))
          : null,
        tokenVersion: access.tokenVersion,
      }
    : access;

export const issuedTo = (
  given: GivenAccess,
  minted: { readonly hash: string },
): GivenAccess =>
  given.mode === 'pull'
    ? { ...given, tokenHash: TokenHash.of(minted.hash) }
    : given;
