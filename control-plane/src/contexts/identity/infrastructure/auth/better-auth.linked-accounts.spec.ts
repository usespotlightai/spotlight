import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { BetterAuthLinkedAccounts } from '@identity/infrastructure/auth/better-auth.linked-accounts';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const LEON = UserId.of('user_leon');

const linking = (
  accounts: readonly { id: string; providerId: string }[],
  getAccessToken: () => Promise<{ accessToken?: string }>,
) => {
  const asked = vi.fn(getAccessToken);
  const auth = {
    $context: Promise.resolve({
      internalAdapter: { findAccounts: vi.fn(async () => accounts) },
    }),
    api: { getAccessToken: asked },
  } as unknown as AppAuth;

  return { linked: new BetterAuthLinkedAccounts(auth), asked };
};

describe('BetterAuthLinkedAccounts', () => {
  it('asks better-auth for a live token on the account linked to that provider', async () => {
    const { linked, asked } = linking(
      [
        { id: 'acc_other', providerId: 'google' },
        { id: 'acc_gh', providerId: 'github' },
      ],
      async () => ({ accessToken: 'gho_live' }),
    );

    expect(await linked.tokenFor(LEON, 'github')).toBe('gho_live');
    expect(asked).toHaveBeenCalledWith({
      body: { accountId: 'acc_gh', userId: 'user_leon' },
    });
  });

  it('has nothing for somebody who never linked that provider', async () => {
    const { linked, asked } = linking([], async () => ({
      accessToken: 'x',
    }));

    expect(await linked.tokenFor(LEON, 'github')).toBeNull();
    expect(asked).not.toHaveBeenCalled();
  });

  it('has nothing where the token could not be refreshed', async () => {
    const { linked } = linking([{ id: 'acc_gh', providerId: 'github' }], () =>
      Promise.reject(new Error('FAILED_TO_GET_ACCESS_TOKEN')),
    );

    expect(await linked.tokenFor(LEON, 'github')).toBeNull();
  });
});
