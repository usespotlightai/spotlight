import type { LineConfigReaderPort } from '@application/ports/line-config-reader.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import { ConfigurationTarget } from '@application/services/configuration-target.service';
import { HeldConfiguration } from '@application/services/held-configuration.service';
import { SeedConfiguration } from '@application/services/seed-configuration.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import { Line } from '@domain/aggregates/line.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
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
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const reader: LineConfigReaderPort = {
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

  return Line.open({
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
    members: [{ userId: UserId.of('user_1'), role: WorkspaceRole.owner }],
    teams: [],
  });

  return connected
    ? held.connectedTo(Connection.of('github', '42'), UserId.of('user_1'))
    : held;
};

const seeding = (
  over: {
    already?: readonly { path: string; text: string }[];
    head?: string | null;
  } = {},
) => {
  const contents = {
    headOf: vi.fn(async () =>
      over.head === undefined ? 'a1b2c3d' : over.head,
    ),
    under: vi.fn(async () => over.already ?? []),
    read: vi.fn(async () => null),
  } as unknown as RepositoryContentsPort;

  const writeInto = vi.fn(async () => ({
    url: 'https://github.com/acme/api/pull/1',
  }));

  return {
    writeInto,
    service: new SeedConfiguration(
      reader,
      new ConfigurationTarget({} as TeamConfigurationRepository),
      new HeldConfiguration(contents),
      { writeInto } as unknown as WriteConfiguration,
    ),
  };
};

describe('SeedConfiguration', () => {
  it('opens a pull request carrying one file for each line', async () => {
    const { service, writeInto } = seeding();

    expect(await service.seed(workspace(), INTO, [line()])).toEqual({
      url: 'https://github.com/acme/api/pull/1',
    });

    const [into, writing] = writeInto.mock.calls[0] as never as [
      { repository: Repository },
      { title: string; files: ConfigurationFile[] },
    ];
    expect(into.repository).toEqual(INTO);
    expect(writing.title).toBe('Set up Spotlight');
    expect(writing.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/delivery.yml',
    ]);
    expect(writing.files[0]?.text).toContain('version: 1');
  });

  it('writes nothing where the repository already has configuration', async () => {
    const { service, writeInto } = seeding({
      already: [{ path: '.spotlight/lines/delivery.yml', text: 'version: 1' }],
    });

    expect(await service.seed(workspace(), INTO, [line()])).toBeNull();
    expect(writeInto).not.toHaveBeenCalled();
  });

  it('writes nothing where the workspace reaches no host', async () => {
    const { service, writeInto } = seeding();

    expect(await service.seed(workspace(false), INTO, [line()])).toBeNull();
    expect(writeInto).not.toHaveBeenCalled();
  });

  it('writes nothing where the repository stands nowhere', async () => {
    const { service, writeInto } = seeding({ head: null });

    expect(await service.seed(workspace(), INTO, [line()])).toBeNull();
    expect(writeInto).not.toHaveBeenCalled();
  });

  it('writes nothing where it is given no lines', async () => {
    const { service, writeInto } = seeding();

    expect(await service.seed(workspace(), INTO, [])).toBeNull();
    expect(writeInto).not.toHaveBeenCalled();
  });
});
