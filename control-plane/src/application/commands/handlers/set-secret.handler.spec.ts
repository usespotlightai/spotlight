import { ForgetSecretCommand } from '@application/commands/forget-secret.command';
import {
  ForgetSecretHandler,
  SetSecretHandler,
} from '@application/commands/handlers/set-secret.handler';
import { SetSecretCommand } from '@application/commands/set-secret.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const acme = (role: WorkspaceRole = 'owner', user = 'user_1') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    // The viewer under test wears `role`; an owner is always in the room too,
    // because a workspace never loses its last one and the guard now says so.
    members:
      role === 'owner'
        ? [{ userId: UserId.of(user), role: 'owner' }]
        : [
            { userId: UserId.of('owner_1'), role: 'owner' },
            { userId: UserId.of(user), role },
          ],
    teams: [],
  });

const setting = (over: { workspace?: Workspace | null } = {}) => {
  const secrets = {
    set: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    resolve: vi.fn(),
    held: vi.fn(),
  } as unknown as TeamSecretsPort;

  const teams = {
    findTeamForMember: vi.fn(async () => ({
      workspaceId: 'ws_1',
      teamId: 'team_1',
      teamKey: 'platform',
      slug: 'acme',
    })),
  } as unknown as WorkspaceReaderPort;

  const workspaces = {
    findBySlug: vi.fn(async () =>
      over.workspace === undefined ? acme() : over.workspace,
    ),
  } as unknown as WorkspaceRepository;

  return {
    secrets,
    set: new SetSecretHandler(workspaces, teams, secrets),
    forget: new ForgetSecretHandler(workspaces, teams, secrets),
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

  // Someone outside it is not told a workspace is there at all.
  it('sets nothing where the caller is not of the workspace', async () => {
    const { set, secrets } = setting({ workspace: acme('owner', 'someone') });

    expect(await set.execute(command())).toBe(false);
    expect(secrets.set).not.toHaveBeenCalled();
  });

  it('sets nothing where there is no such workspace', async () => {
    const { set, secrets } = setting({ workspace: null });

    expect(await set.execute(command())).toBe(false);
    expect(secrets.set).not.toHaveBeenCalled();
  });

  // A secret stands in for a session at a door anybody can knock at, so who
  // may set one is who may connect a host.
  it('refuses a member who is neither owner nor admin', async () => {
    const { set, secrets } = setting({ workspace: acme('member') });

    expect(await set.execute(command())).toBe(false);
    expect(secrets.set).not.toHaveBeenCalled();
  });

  it('lets an admin set one', async () => {
    const { set, secrets } = setting({ workspace: acme('admin') });

    expect(await set.execute(command())).toBe(true);
    expect(secrets.set).toHaveBeenCalled();
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

  it('forgets nothing for a member who may not set one either', async () => {
    const { forget, secrets } = setting({ workspace: acme('member') });

    expect(
      await forget.execute(
        new ForgetSecretCommand('team_1', 'LINEAR_WEBHOOK_SECRET', 'user_1'),
      ),
    ).toBe(false);
    expect(secrets.forget).not.toHaveBeenCalled();
  });
});
