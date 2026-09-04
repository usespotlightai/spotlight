import { PinConfigurationHandler } from '@application/commands/handlers/pin-configuration.handler';
import { PinConfigurationCommand } from '@application/commands/pin-configuration.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [],
});

const acme = (role: WorkspaceRole = 'owner') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of('user_1'), role }],
    teams: [TEAM.id],
    connections: [Connection.of('github', '158883204')],
  });

const pinning = (
  over: {
    workspace?: Workspace | null;
    team?: null;
    of?: null;
    held?: { fullName: string }[];
  } = {},
) => {
  const save = vi.fn(async () => {});
  const trySeed = vi.fn(async () => null);
  const settling = vi.fn(async () => {});
  const create = vi.fn(async () => true);
  const list = vi.fn(async () => over.held ?? [{ fullName: 'acme/api' }]);

  return {
    save,
    trySeed,
    create,
    settling,
    handler: new PinConfigurationHandler(
      {
        findTeamForMember: vi.fn(async () =>
          over.of === null
            ? null
            : {
                workspaceId: 'ws_1',
                teamId: 'team_1',
                teamKey: 'platform',
                slug: 'acme',
              },
        ),
      } as unknown as WorkspaceReaderPort,
      {
        findBySlug: vi.fn(async () =>
          over.workspace === undefined ? acme() : over.workspace,
        ),
      } as unknown as WorkspaceRepository,
      {
        find: vi.fn(async () => (over.team === null ? null : TEAM)),
        save,
      } as unknown as TeamRepository,
      { trySeed } as never,
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

  // Someone outside it is not told a team is there at all.
  it('says nothing where the caller is not of the team', async () => {
    const { handler, save } = pinning({ of: null });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  // It decides what an agent is told to do, so it is not a member's to change.
  it('refuses a member who is neither owner nor admin', async () => {
    const { handler, save } = pinning({ workspace: acme('member') });

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

  it('opens the configuration in the repository just chosen', async () => {
    const { handler, trySeed } = pinning();

    await handler.execute(command());

    expect(trySeed).toHaveBeenCalledTimes(1);
    const [, , into] = trySeed.mock.calls[0] as never as [
      unknown,
      unknown,
      { value: string },
    ];
    expect(into.value).toBe('acme/api');
  });

  it('writes nothing where the choice was taken off', async () => {
    const { handler, trySeed } = pinning();

    await handler.execute(command(null));

    expect(trySeed).not.toHaveBeenCalled();
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
