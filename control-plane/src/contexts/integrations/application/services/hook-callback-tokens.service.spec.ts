import { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import type { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import type { HookCallbackTokenRepository } from '@integrations/domain/repositories/hook-callback-token.repository';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const HASH = 'a'.repeat(64);

const setUp = () => {
  const added: HookCallbackToken[] = [];
  const repository = {
    add: vi.fn(async (callbackToken: HookCallbackToken) => {
      added.push(callbackToken);
    }),
    withToken: vi.fn(async () => null),
    purgeExpiringBefore: vi.fn(async () => {}),
  } satisfies HookCallbackTokenRepository;
  const callbackTokens = new HookCallbackTokens(
    repository,
    { issue: () => ({ token: 'token', hash: HASH }), hash: () => HASH },
    { now: () => NOW, sleep: async () => {} },
  );

  return { callbackTokens, repository, added };
};

describe('HookCallbackTokens', () => {
  it('issues a token from the clock and purges those expired by then', async () => {
    const { callbackTokens, repository, added } = setUp();

    const token = await callbackTokens.issued({
      workspaceId: 'workspace_1',
      taskId: 'task_1',
      hook: 'dba-review',
      firing: null,
    });

    expect(token).toBe('token');
    expect(repository.purgeExpiringBefore).toHaveBeenCalledWith(NOW);
    expect(added[0]?.expiresAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });
});
