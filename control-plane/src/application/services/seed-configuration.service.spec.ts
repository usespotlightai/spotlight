import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import { SeedConfiguration } from '@application/services/seed-configuration.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@domain/services/built-in-lines';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Connection } from '@domain/value-objects/connection.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Repository } from '@domain/value-objects/repository.vo';
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

const line = () => {
  let next = 0;

  return AssemblyLine.open({
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    line: BUILT_IN_LINES[0] as LineOpening,
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

  const service = new SeedConfiguration(reader, contents, {
    propose,
    open: vi.fn(),
  } as unknown as PullRequestPort);

  return { service, propose, lines: over.lines ?? [line()] };
};

describe('SeedConfiguration', () => {
  it('opens a pull request carrying the lines it is given', async () => {
    const { service, propose, lines } = seeding();

    expect(await service.seed(workspace(), INTO, lines)).toEqual({
      url: 'https://github.com/acme/api/pull/1',
    });
    expect(propose).toHaveBeenCalledTimes(1);
  });

  it('writes one file for each line, where that line is read from', async () => {
    const { service, propose, lines } = seeding();

    await service.seed(workspace(), INTO, lines);

    const [proposal] = propose.mock.calls[0] as never as [
      { files: { path: string; text: string }[] },
    ];

    expect(proposal.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/delivery.yml',
    ]);
    expect(proposal.files[0]?.text).toContain('version: 1');
  });

  // Opening a pull request over somebody's own files is not a welcome.
  it('writes nothing where the repository already has configuration', async () => {
    const { service, propose, lines } = seeding({
      already: [{ path: '.spotlight/lines/delivery.yml', text: 'version: 1' }],
    });

    expect(await service.seed(workspace(), INTO, lines)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where the workspace reaches no host', async () => {
    const { service, propose, lines } = seeding();

    expect(await service.seed(workspace(false), INTO, lines)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where the repository stands nowhere', async () => {
    const { service, propose, lines } = seeding({ head: null });

    expect(await service.seed(workspace(), INTO, lines)).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });

  it('writes nothing where it is given no lines', async () => {
    const { service, propose } = seeding();

    expect(await service.seed(workspace(), INTO, [])).toBeNull();
    expect(propose).not.toHaveBeenCalled();
  });
});
