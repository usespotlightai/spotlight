import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import { WriteBackLine } from '@application/services/write-back-line.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Connection } from '@domain/value-objects/connection.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

/** A reader as the port describes one. The real renderer has its own test. */
const reader: LineReaderPort = {
  read: () => ({ plans: [], problems: [] }),
  write: (each) =>
    ConfigurationFile.of(
      `.spotlight/lines/${each.key.value}.yml`,
      `version: 1
key: ${each.key.value}
name: ${each.name.value}
`,
    ),
};

const line = () => {
  let next = 0;

  return AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    newId: () => `id_${++next}`,
  });
};

const workspace = (connected = true) => {
  const held = Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [{ userId: UserId.of('user_1'), role: 'owner' }],
    teams: [],
  });

  return connected
    ? held.connectedTo(Connection.of('github', '42'), UserId.of('user_1'))
    : held;
};

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [],
});

const applied = () =>
  TeamConfiguration.read({
    teamId: TeamId.of('team_1'),
    repository: Repository.of('acme/api'),
    commit: Commit.of('a1b2c3d'),
    files: [],
    readAt: new Date(),
  });

const writing = (
  over: { applied?: TeamConfiguration | null; head?: string | null } = {},
) => {
  const propose = vi.fn(async () => ({
    url: 'https://github.com/acme/api/pull/4',
  }));

  const service = new WriteBackLine(
    {
      findFor: vi.fn(async () =>
        over.applied === undefined ? applied() : over.applied,
      ),
      save: vi.fn(),
    } as unknown as TeamConfigurationRepository,
    reader,
    {
      headOf: vi.fn(async () =>
        over.head === undefined ? 'a1b2c3d' : over.head,
      ),
      under: vi.fn(async () => []),
      read: vi.fn(async () => null),
    } as unknown as RepositoryContentsPort,
    { propose, open: vi.fn() } as unknown as PullRequestPort,
  );

  return { service, propose };
};

describe('WriteBackLine', () => {
  it('proposes the line as the file that describes it', async () => {
    const { service, propose } = writing();

    expect(await service.write(workspace(), TEAM, line())).toEqual({
      kind: 'proposed',
      url: 'https://github.com/acme/api/pull/4',
    });

    const [proposal] = propose.mock.calls[0] as never as [
      { files: { path: string; text: string }[]; branch: string },
    ];

    expect(proposal.files[0]?.path).toBe('.spotlight/lines/default.yml');
    expect(proposal.files[0]?.text).toContain('name: Default');
  });

  // One branch for configuration, written on again rather than beside.
  it('writes on the branch configuration is always written on', async () => {
    const { service, propose } = writing();

    await service.write(workspace(), TEAM, line());

    const [proposal] = propose.mock.calls[0] as never as [{ branch: string }];

    expect(proposal.branch).toBe('spotlight/configuration');
  });

  // What is in the repository now has not been looked at.
  it('says so rather than writing over a repository that has moved', async () => {
    const { service, propose } = writing({ head: 'e4f5a6b' });

    expect(await service.write(workspace(), TEAM, line())).toEqual({
      kind: 'moved',
    });
    expect(propose).not.toHaveBeenCalled();
  });

  it('has nowhere to write before anything has been read', async () => {
    const { service, propose } = writing({ applied: null });

    expect(await service.write(workspace(), TEAM, line())).toEqual({
      kind: 'nowhere',
    });
    expect(propose).not.toHaveBeenCalled();
  });

  it('has nowhere to write where the workspace reaches no host', async () => {
    const { service, propose } = writing();

    expect(await service.write(workspace(false), TEAM, line())).toEqual({
      kind: 'nowhere',
    });
    expect(propose).not.toHaveBeenCalled();
  });
});
