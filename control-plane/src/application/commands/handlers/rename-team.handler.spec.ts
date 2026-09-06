import { RenameTeamHandler } from '@application/commands/handlers/rename-team.handler';
import { RenameTeamCommand } from '@application/commands/rename-team.command';
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
  members: [{ userId: UserId.of('user_1'), role: 'owner' }],
});

const acme = (role: WorkspaceRole = 'owner') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members:
      role === 'owner'
        ? [{ userId: UserId.of('user_1'), role: 'owner' }]
        : [
            { userId: UserId.of('owner_1'), role: 'owner' },
            { userId: UserId.of('user_1'), role },
          ],
    teams: [TEAM.id],
    connections: [Connection.of('github', '158883204')],
  });

const renaming = (
  over: { workspace?: Workspace | null; team?: null; of?: null } = {},
) => {
  const save = vi.fn(async () => {});

  return {
    save,
    handler: new RenameTeamHandler(
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
    ),
  };
};

const command = (name = 'Platform Team') =>
  new RenameTeamCommand('team_1', name, 'user_1');

describe('RenameTeamHandler', () => {
  it('gives the team its new name', async () => {
    const { handler, save } = renaming();

    expect(await handler.execute(command())).toBe(true);

    const [saved] = save.mock.calls[0] as never as [Team];
    expect(saved.name.value).toBe('Platform Team');
  });

  // Someone outside it is not told a team is there at all.
  it('says nothing where the caller is not of the team', async () => {
    const { handler, save } = renaming({ of: null });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a member who is neither owner nor admin', async () => {
    const { handler, save } = renaming({ workspace: acme('member') });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('says nothing where there is no such team', async () => {
    const { handler, save } = renaming({ team: null });

    expect(await handler.execute(command())).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a name that is nothing but spaces', async () => {
    const { handler } = renaming();

    await expect(handler.execute(command('   '))).rejects.toBeInstanceOf(
      UseCaseFault,
    );
  });
});
