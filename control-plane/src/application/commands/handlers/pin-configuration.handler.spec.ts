import { PinConfigurationHandler } from '@application/commands/handlers/pin-configuration.handler';
import { PinConfigurationCommand } from '@application/commands/pin-configuration.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [{ userId: UserId.of('user_1'), role: 'owner' }],
});

// The workspace the authorization hands back — it carries the connection the
// seeding needs.
const acme = () =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of('user_1'), role: 'owner' }],
    teams: [TEAM.id],
    connections: [Connection.of('github', '158883204')],
  });

// Who may pin lives in ConnectionAuthorization, tested there; here it is only
// whether the gate opens.
const pinning = (
  over: { allowed?: boolean; team?: null; held?: { fullName: string }[] } = {},
) => {
  const save = vi.fn(async () => {});
  const settling = vi.fn(async () => {});
  const create = vi.fn(async () => true);
  const list = vi.fn(async () => over.held ?? [{ fullName: 'acme/api' }]);

  return {
    save,
    create,
    settling,
    handler: new PinConfigurationHandler(
      {
        connectableBy: vi.fn(async () =>
          over.allowed === false ? null : acme(),
        ),
      } as unknown as ConnectionAuthorization,
      {
        find: vi.fn(async () => (over.team === null ? null : TEAM)),
        save,
      } as unknown as TeamRepository,
      { list, create } as never,
      { forTeam: settling } as never,
    ),
  };
};

const command = (repository: string | null = 'acme/api') =>
  new PinConfigurationCommand('team_1', repository, 'user_1');

describe('PinConfigurationHandler', () => {
  it('says which repository the team reads from', async () => {
    const { handler, save } = pinning();

    expect(await handler.execute(command())).toBe(true);

    const [saved] = save.mock.calls[0] as never as [Team];
    expect(saved.configRepository?.value).toBe('acme/api');
  });

  it('looks at whether that was the last step', async () => {
    const { handler, settling } = pinning();

    await handler.execute(command());

    expect(settling).toHaveBeenCalled();
  });

  // Left unchosen, the rule that guesses applies again.
  it('takes the choice off again', async () => {
    const { handler, save } = pinning();

    expect(await handler.execute(command(null))).toBe(true);

    const [saved] = save.mock.calls[0] as never as [Team];
    expect(saved.configRepository).toBeNull();
  });

  it('says nothing where the caller may not connect the team’s hosts', async () => {
    const { handler, save } = pinning({ allowed: false });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('says nothing where there is no such team', async () => {
    const { handler, save } = pinning({ team: null });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses something that is not a repository name', async () => {
    const { handler } = pinning();

    await expect(handler.execute(command('not a repo'))).rejects.toBeInstanceOf(
      UseCaseFault,
    );
  });

  // Naming one Spotlight cannot see means they want it.
  it('makes a repository nobody has yet', async () => {
    const { handler, create } = pinning({ held: [] });

    await handler.execute(command());

    expect(create).toHaveBeenCalledTimes(1);
    const [, made] = create.mock.calls[0] as never as [
      unknown,
      { value: string },
    ];
    expect(made.value).toBe('acme/api');
  });

  it('makes nothing where the installation already has it', async () => {
    const { handler, create } = pinning();

    await handler.execute(command());

    expect(create).not.toHaveBeenCalled();
  });
});
