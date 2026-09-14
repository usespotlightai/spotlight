import { ReadConfigurationHandler } from '@application/commands/handlers/read-configuration.handler';
import { ReadConfigurationCommand } from '@application/commands/read-configuration.command';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ReadConfiguration } from '@application/services/read-configuration.service';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const READ = { repository: 'acme/api', sha: 'sha_1', problems: [] };

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
});

const acme = (member = 'user_1') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of(member), role: WorkspaceRole.owner }],
    teams: [TeamId.of('team_1')],
  });

const reading = (
  over: { workspace?: Workspace | null; read?: unknown; team?: null } = {},
) => {
  const read = vi.fn(async () => (over.read === undefined ? READ : over.read));

  return {
    read,
    handler: new ReadConfigurationHandler(
      {
        findBySlug: vi.fn(async () =>
          over.workspace === undefined ? acme() : over.workspace,
        ),
      } as unknown as WorkspaceRepository,
      {
        identify: vi.fn(),
        identifyTeam: vi.fn(),
        findTeamForMember: vi.fn(async () =>
          over.team === undefined
            ? {
                workspaceId: 'ws_1',
                teamId: 'team_1',
                teamKey: 'platform',
                slug: 'acme',
              }
            : over.team,
        ),
        listForMember: vi.fn(),
        findForMember: vi.fn(),
      } as unknown as WorkspaceReaderPort,
      {
        find: vi.fn(async () => (over.team === null ? null : TEAM)),
        add: vi.fn(),
        save: vi.fn(),
        named: vi.fn(),
        ofWorkspace: vi.fn(async () => [TEAM]),
        readingFrom: vi.fn(async () => []),
      } as unknown as TeamRepository,
      { read } as unknown as ReadConfiguration,
    ),
  };
};

const command = () => new ReadConfigurationCommand('acme', 'user_1');

describe('ReadConfigurationHandler', () => {
  it('reads it and answers with what was found', async () => {
    const { handler, read } = reading();

    expect(await handler.execute(command())).toEqual(READ);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('answers with nothing where there is no such workspace', async () => {
    const { handler, read } = reading({ workspace: null });

    expect(await handler.execute(command())).toBeNull();
    expect(read).not.toHaveBeenCalled();
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
