import { RunnerTokens } from '@runners/application/services/runner-tokens.service';
import {
  aRunner,
  hashOf,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { describe, expect, it, vi } from 'vitest';

const tokensAt = (now: Date) =>
  new RunnerTokens(
    {
      findByTokenHash: vi.fn(async (hash: TokenHash) =>
        hash.equals(hashOf('b')) ? aRunner() : null,
      ),
    } as unknown as RunnerRepository,
    { hash: () => hashOf('b').value } as unknown as TokenIssuer,
    { now: () => now, sleep: async () => {} },
  );

describe('RunnerTokens', () => {
  it('names the runner a token speaks for while that runner is alive', async () => {
    await expect(
      tokensAt(new Date(STARTED_AT.getTime() + 1_000)).authenticate('token'),
    ).resolves.toEqual(RunnerId.of('pooled_1'));
  });

  it('names no runner once its claim window passed, or for no token', async () => {
    await expect(
      tokensAt(new Date(STARTED_AT.getTime() + 61_000)).authenticate('token'),
    ).resolves.toBeNull();
    await expect(tokensAt(STARTED_AT).authenticate(undefined)).resolves.toBe(
      null,
    );
  });
});
