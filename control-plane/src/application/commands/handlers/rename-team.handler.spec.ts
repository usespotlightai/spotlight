import { RenameTeamHandler } from '@application/commands/handlers/rename-team.handler';
import { RenameTeamCommand } from '@application/commands/rename-team.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
});

const renaming = (over: { allowed?: boolean; team?: null } = {}) => {
  const save = vi.fn(async () => {});

  return {
    save,
    handler: new RenameTeamHandler(
      {
        connectableBy: vi.fn(async () =>
          over.allowed === false ? null : ({} as Workspace),
        ),
      } as unknown as ConnectionAuthorization,
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

  it('says nothing where the caller may not connect the team’s hosts', async () => {
    const { handler, save } = renaming({ allowed: false });

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
