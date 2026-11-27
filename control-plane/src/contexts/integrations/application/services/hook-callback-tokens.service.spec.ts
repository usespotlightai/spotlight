import { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { HookCallbackToken } from '@integrations/domain/aggregates/hook-callback-token.aggregate';
import { HookCallbackTokenVersionConflictError } from '@integrations/domain/exceptions/hook-callback-token-version-conflict.error';
import type { HookCallbackTokenRepository } from '@integrations/domain/repositories/hook-callback-token.repository';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const HASH = 'a'.repeat(64);

const EXPIRED = HookCallbackToken.rehydrate({
  tokenHash: TokenHash.of('b'.repeat(64)),
  workspaceId: WorkspaceId.of('workspace_1'),
  taskId: TaskId.of('task_1'),
  hook: HookKey.of('dba-review'),
  firing: null,
  expiresAt: new Date(NOW.getTime() - 1),
  version: 1,
});

const setUp = (expired: HookCallbackToken[] = []) => {
  const added: HookCallbackToken[] = [];
  const repository = {
    add: vi.fn(async (callbackToken: HookCallbackToken) => {
      added.push(callbackToken);
    }),
    withToken: vi.fn(async () => null),
    expiredBefore: vi.fn(async () => expired),
    remove: vi.fn(async () => {}),
  } satisfies HookCallbackTokenRepository;
  const callbackTokens = new HookCallbackTokens(
    repository,
    { issue: () => ({ token: 'token', hash: HASH }), hash: () => HASH },
    { now: () => NOW, sleep: async () => {} },
  );

  return { callbackTokens, repository, added };
};

describe('HookCallbackTokens', () => {
  it('issues a token from the clock, purging nothing on the way', async () => {
    const { callbackTokens, repository, added } = setUp([EXPIRED]);

    const token = await callbackTokens.issued({
      workspaceId: WorkspaceId.of('workspace_1'),
      taskId: TaskId.of('task_1'),
      hook: HookKey.of('dba-review'),
      firing: null,
    });

    expect(token).toBe('token');
    expect(repository.expiredBefore).not.toHaveBeenCalled();
    expect(added[0]?.expiresAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });

  it('purges the tokens expired by now, one at its version', async () => {
    const { callbackTokens, repository } = setUp([EXPIRED]);

    await expect(callbackTokens.purgeExpired()).resolves.toBe(1);
    expect(repository.expiredBefore).toHaveBeenCalledWith(NOW, 100);
    expect(repository.remove).toHaveBeenCalledWith(EXPIRED);
  });

  it('leaves a token another purge removed first', async () => {
    const { callbackTokens, repository } = setUp([EXPIRED]);
    repository.remove.mockRejectedValueOnce(
      new HookCallbackTokenVersionConflictError(),
    );

    await expect(callbackTokens.purgeExpired()).resolves.toBe(1);
  });
});
