import { ReadConfigurationHandler } from '@configuration/application/commands/handlers/read-configuration.handler';
import { ReadConfigurationCommand } from '@configuration/application/commands/read-configuration.command';
import type {
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import type { ReadConfiguration } from '@configuration/application/services/read-configuration.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const READ = { repository: 'acme/api', sha: 'sha_1', problems: [] };

const TEAM: TeamStanding = {
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  connected: true,
  viewer: UserId.of('user_1'),
  administers: true,
};

const reading = (over: { read?: unknown; team?: null } = {}) => {
  const read = vi.fn(async () => (over.read === undefined ? READ : over.read));

  return {
    read,
    handler: new ReadConfigurationHandler(
      {
        find: vi.fn(),
        viewedBy: vi.fn(async () => (over.team === null ? null : TEAM)),
        inWorkspace: vi.fn(),
      } satisfies TeamsPort,
      { read } as unknown as ReadConfiguration,
    ),
  };
};

const command = () => new ReadConfigurationCommand('team_1', 'user_1');

describe('ReadConfigurationHandler', () => {
  it('reads it for the team and answers with what was found', async () => {
    const { handler, read } = reading();

    expect(await handler.execute(command())).toEqual(READ);
    expect(read).toHaveBeenCalledWith(TEAM);
  });

  it('answers with nothing where the caller is not of the team', async () => {
    const { handler, read } = reading({ team: null });

    expect(await handler.execute(command())).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('answers with nothing where there is nowhere to read it from', async () => {
    const { handler } = reading({ read: null });

    expect(await handler.execute(command())).toBeNull();
  });
});
