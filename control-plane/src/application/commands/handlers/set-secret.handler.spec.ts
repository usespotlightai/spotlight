import { ForgetSecretCommand } from '@application/commands/forget-secret.command';
import {
  ForgetSecretHandler,
  SetSecretHandler,
} from '@application/commands/handlers/set-secret.handler';
import { SetSecretCommand } from '@application/commands/set-secret.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { describe, expect, it, vi } from 'vitest';

// The role logic lives in ConnectionAuthorization, tested there; here it is only
// whether the gate opens.
const setting = (over: { allowed?: boolean } = {}) => {
  const secrets = {
    set: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    resolve: vi.fn(),
    held: vi.fn(),
  } as unknown as TeamSecretsPort;

  const authorization = {
    connectableBy: vi.fn(async () =>
      over.allowed === false ? null : ({} as Workspace),
    ),
  } as unknown as ConnectionAuthorization;

  return {
    secrets,
    set: new SetSecretHandler(authorization, secrets),
    forget: new ForgetSecretHandler(authorization, secrets),
  };
};

const command = (value = 'whsec_abc123', name = 'LINEAR_WEBHOOK_SECRET') =>
  new SetSecretCommand('team_1', name, value, 'user_1');

describe('SetSecretHandler', () => {
  it('sets it, and says only that it did', async () => {
    const { set, secrets } = setting();

    expect(await set.execute(command())).toBe(true);
    expect(secrets.set).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'team_1' }),
      expect.objectContaining({ value: 'LINEAR_WEBHOOK_SECRET' }),
      expect.objectContaining({ value: 'whsec_abc123' }),
    );
  });

  it('sets nothing where the caller may not connect the host', async () => {
    const { set, secrets } = setting({ allowed: false });

    expect(await set.execute(command())).toBe(false);
    expect(secrets.set).not.toHaveBeenCalled();
  });

  // Empty is not a secret; forgetting one is its own thing to ask for.
  it('refuses an empty one', async () => {
    const { set, secrets } = setting();

    expect(await set.execute(command('   '))).toBe(false);
    expect(secrets.set).not.toHaveBeenCalled();
  });

  it('refuses a name nobody could have written in a file', async () => {
    const { set } = setting();

    await expect(
      set.execute(command('whsec_1', 'not a secret name')),
    ).rejects.toBeInstanceOf(UseCaseFault);
  });
});

describe('ForgetSecretHandler', () => {
  it('forgets it', async () => {
    const { forget, secrets } = setting();

    expect(
      await forget.execute(
        new ForgetSecretCommand('team_1', 'LINEAR_WEBHOOK_SECRET', 'user_1'),
      ),
    ).toBe(true);
    expect(secrets.forget).toHaveBeenCalled();
  });

  it('forgets nothing for a caller who may not connect the host', async () => {
    const { forget, secrets } = setting({ allowed: false });

    expect(
      await forget.execute(
        new ForgetSecretCommand('team_1', 'LINEAR_WEBHOOK_SECRET', 'user_1'),
      ),
    ).toBe(false);
    expect(secrets.forget).not.toHaveBeenCalled();
  });
});
