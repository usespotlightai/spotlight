import { RenameTeamHandler } from '@identity/application/commands/handlers/rename-team.handler';
import { RenameTeamCommand } from '@identity/application/commands/rename-team.command';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [UserId.of('user_1')],
});

const renaming = (over: { allowed?: boolean } = {}) => {
  const save = vi.fn(async () => {});

  return {
    save,
    handler: new RenameTeamHandler(
      {
        administeredBy: vi.fn(async () =>
          over.allowed === false
            ? null
            : {
                team: TEAM,
                workspace: {} as Workspace,
                by: UserId.of('user_1'),
              },
        ),
      } as unknown as TeamAdministration,
      {
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

  it('says nothing where the caller does not administer the team, or there is no such team', async () => {
    const { handler, save } = renaming({ allowed: false });

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
