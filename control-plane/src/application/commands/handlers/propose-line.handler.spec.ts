import { ProposeLineHandler } from '@application/commands/handlers/propose-line.handler';
import { ProposeLineCommand } from '@application/commands/propose-line.command';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { WriteBackLine } from '@application/services/write-back-line.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const PROPOSED = { kind: 'proposed', url: 'https://github.com/x/y/pull/1' };

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [],
});

const acme = (member = 'user_1') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of(member), role: 'owner' }],
    teams: [TeamId.of('team_1')],
  });

const line = (workspaceId = 'ws_1') => {
  let next = 0;

  return AssemblyLine.open({
    workspaceId: WorkspaceId.of(workspaceId),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    newId: () => `id_${++next}`,
  });
};

const proposing = (
  over: {
    workspace?: Workspace | null;
    line?: AssemblyLine | null;
    team?: null;
  } = {},
) => {
  const write = vi.fn(async () => PROPOSED);

  return {
    write,
    handler: new ProposeLineHandler(
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
      {
        find: vi.fn(async () => (over.line === undefined ? line() : over.line)),
      } as unknown as AssemblyLineRepository,
      { write } as unknown as WriteBackLine,
    ),
  };
};

const command = () => new ProposeLineCommand('acme', 'line_1', 'user_1');

describe('ProposeLineHandler', () => {
  it('writes the line back and answers with the pull request', async () => {
    const { handler, write } = proposing();

    expect(await handler.execute(command())).toEqual(PROPOSED);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('answers with nothing where there is no such workspace', async () => {
    const { handler, write } = proposing({ workspace: null });

    expect(await handler.execute(command())).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  // Someone outside it is not told a workspace is there at all.
  it('answers with nothing where the caller is not of the team', async () => {
    const { handler, write } = proposing({ team: null });

    expect(await handler.execute(command())).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('answers with nothing where there is no such line', async () => {
    const { handler, write } = proposing({ line: null });

    expect(await handler.execute(command())).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  // One workspace's board may not write into another's repository.
  it('refuses a line belonging to another workspace', async () => {
    const { handler, write } = proposing({ line: line('ws_2') });

    expect(await handler.execute(command())).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });
});
