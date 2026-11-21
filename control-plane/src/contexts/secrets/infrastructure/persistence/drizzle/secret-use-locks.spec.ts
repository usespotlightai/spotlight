import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleSecretUseLocks } from '@secrets/infrastructure/persistence/drizzle/secret-use-locks';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const contextWith = (transacting: boolean) => {
  const execute = vi.fn(async () => ({ rows: [] }));

  return {
    execute,
    locks: new DrizzleSecretUseLocks({
      transacting,
      db: { execute },
    } as unknown as DrizzleContext),
  };
};

describe('DrizzleSecretUseLocks', () => {
  it('takes the workspace’s lock inside a transaction', async () => {
    const { execute, locks } = contextWith(true);

    await locks.lock(WorkspaceId.of('ws_1'));

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('refuses to lock outside a transaction, where the lock would end at once', async () => {
    const { execute, locks } = contextWith(false);

    await expect(locks.lock(WorkspaceId.of('ws_1'))).rejects.toThrow(
      'A lock on the uses of secrets needs a transaction',
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
