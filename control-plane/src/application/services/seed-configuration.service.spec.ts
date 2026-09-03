import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import { SeedConfiguration } from '@application/services/seed-configuration.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
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

const INTO = Repository.of('acme/api');

const TEAM = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [],
});

const logger = { error: vi.fn() } as unknown as LoggerPort;

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
    teams: [TEAM.id],
  });

  return connected
    ? held.connectedTo(Connection.of('github', '42'), UserId.of('user_1'))
    : held;
};

const seeding = (
  over: {
    lines?: readonly AssemblyLine[];
    already?: readonly { path: string; text: string }[];
    head?: string | null;
  } = {},
) => {
  const propose = vi.fn(async () => ({
    url: 'https://github.com/acme/api/pull/1',
  }));

  const contents = {
    headOf: vi.fn(async () =>
      over.head === undefined ? 'a1b2c3d' : over.head,
    ),
    under: vi.fn(async () => over.already ?? []),
    read: vi.fn(async () => null),
  } as unknown as RepositoryContentsPort;

  const service = new SeedConfiguration(
    {
      ofTeam: vi.fn(async () => over.lines ?? [line()]),
      ofWorkspace: vi.fn(async () => over.lines ?? [line()]),
    } as unknown as AssemblyLineRepository,
    reader,
    contents,
    { propose, open: vi.fn() } as unknown as PullRequestPort,
    logger,
  );

  return { service, propose, contents };
};

describe('SeedConfiguration', () => {
  it('opens a pull request carrying what the workspace already runs', async () => {
    const { service, propose } = seeding();

    expect(await service.seed(workspace(), TEAM, INTO)).toEqual({
      url: 'https://github.com/acme/api/pull/1',
    });
    expect(propose).toHaveBeenCalledTimes(1);
  });

  it('writes one file for each line, where that line is read from', async () => {
    const { service, propose } = seeding();

    await service.seed(workspace(), TEAM, INTO);

    const [proposal] = propose.mock.calls[0] as never as [
      { files: { path: string; text: string }[] },
    ];

    expect(proposal.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/default.yml',
    ]);
    expect(proposal.files[0]?.text).toContain('version: 1');
  });

  // Opening a pull request over somebody's own files is not a welcome.
  it('writes nothing where the repository already has configuration', async () => {
    const { service, propose } = seeding({
      already: [{ path: '.spotlight/lines/default.yml', text: 'version: 1' }],
    });

    expect(await service.seed(workspace(), TEAM, INTO)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where the workspace reaches no host', async () => {
    const { service, propose } = seeding();

    expect(await service.seed(workspace(false), TEAM, INTO)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where the repository stands nowhere', async () => {
    const { service, propose } = seeding({ head: null });

    expect(await service.seed(workspace(), TEAM, INTO)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where the workspace runs no lines', async () => {
    const { service, propose } = seeding({ lines: [] });

    expect(await service.seed(workspace(), TEAM, INTO)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  // Connecting is not to be undone by somebody else's machine answering.
  it('does not fail connecting when writing goes wrong', async () => {
    const { service } = seeding();
    const failing = new SeedConfiguration(
      {
        ofTeam: vi.fn(async () => {
          throw new Error('GitHub would not answer');
        }),
      } as unknown as AssemblyLineRepository,
      reader,
      (service as never as { contents: RepositoryContentsPort }).contents,
      { propose: vi.fn(), open: vi.fn() } as unknown as PullRequestPort,
      logger,
    );

    await expect(failing.trySeed(workspace(), TEAM, INTO)).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});
