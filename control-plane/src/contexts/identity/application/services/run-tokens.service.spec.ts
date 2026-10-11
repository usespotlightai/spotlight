import { RunTokens } from '@identity/application/services/run-tokens.service';
import type { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenRevoked } from '@identity/domain/events/workspace-token-revoked.event';
import { WorkspaceTokenMovedOnError } from '@identity/domain/exceptions/workspace-token-moved-on.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-11T09:00:00.000Z');
const HOUR_LATER = new Date('2026-10-11T10:00:00.000Z');

const using = () => {
  const held: WorkspaceToken[] = [];
  const saved: WorkspaceToken[] = [];
  const tokens = {
    add: vi.fn(async (token: WorkspaceToken) => {
      held.push(token);
    }),
    save: vi.fn(async (token: WorkspaceToken) => {
      saved.push(token);
    }),
    mintedForRun: vi.fn(async () => held),
    find: vi.fn(async () => held[0] ?? null),
  } as unknown as WorkspaceTokenRepository;
  const service = new RunTokens(
    tokens,
    {
      mint: () => ({ token: 'raw-token', hash: 'b'.repeat(64) }),
    } as unknown as TokenMintPort,
    { generate: () => 'Token_1' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
  );

  return { service, tokens, held, saved };
};

const WANTED = {
  workspaceId: 'ws_1',
  runId: 'run_1',
  attempt: 2,
  issuedBy: 'user_1',
  scopes: ['plan'],
  expiresAt: HOUR_LATER,
};

describe('RunTokens', () => {
  it('answers the raw token once and keeps only its hash, minted for the run', async () => {
    const { service, held } = using();

    await expect(service.mintFor(WANTED)).resolves.toEqual({
      id: 'Token_1',
      token: 'raw-token',
    });
    expect(held[0]?.hash.value).toBe('b'.repeat(64));
    expect(held[0]?.mintedForRun?.value).toBe('run_1');
    expect(held[0]?.mintedForAttempt).toBe(2);
    expect(held[0]?.name.value).toBe('run-token-1');
    expect(held[0]?.expiresAt).toEqual(HOUR_LATER);
    expect(held[0]?.scopes.all.map((each) => each.value)).toEqual(['plan']);
  });

  it('revokes every token minted for the run', async () => {
    const { service, saved } = using();

    await service.mintFor(WANTED);
    await service.revokeFor('ws_1', 'run_1', null);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.isRevoked).toBe(true);
    expect(saved[0]?.pullEvents()).toContainEqual(
      expect.any(WorkspaceTokenRevoked),
    );
  });

  it('leaves alone a token revoked meanwhile', async () => {
    const { service, tokens } = using();

    await service.mintFor(WANTED);
    vi.mocked(tokens.save).mockRejectedValueOnce(
      new WorkspaceTokenMovedOnError('Token_1'),
    );

    await expect(
      service.revokeFor('ws_1', 'run_1', null),
    ).resolves.toBeUndefined();
  });

  it('revokes the one token it is named, in its workspace', async () => {
    const { service, saved } = using();

    await service.mintFor(WANTED);
    await service.revoke('ws_2', 'Token_1');
    expect(saved).toHaveLength(0);

    await service.revoke('ws_1', 'Token_1');
    expect(saved[0]?.isRevoked).toBe(true);
  });
});
