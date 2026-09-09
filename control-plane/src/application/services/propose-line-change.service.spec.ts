import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ConfigurationTarget } from '@application/services/configuration-target.service';
import { ProposeLineChange } from '@application/services/propose-line-change.service';
import type { WriteConfiguration } from '@application/services/write-configuration.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import { Station } from '@domain/entities/station.entity';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Connection } from '@domain/value-objects/connection.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        name: StationName.of('Triage'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
      }),
      Station.of({
        id: StationId.of('station_2'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const workspace = {
  connectionTo: () => Connection.of('github', '42'),
} as unknown as Workspace;

const team = { configRepository: Repository.of('acme/api') } as unknown as Team;

const proposing = (
  found: AssemblyLine | null = line(),
  branchFile: { path: string; text: string } | null = null,
  member: { slug: string } | null = { slug: 'acme' },
) => {
  let rendered: AssemblyLine | undefined;

  const members = {
    findTeamForMember: vi.fn(async () =>
      member
        ? {
            workspaceId: 'ws_1',
            teamId: 'team_1',
            teamKey: 'core',
            slug: member.slug,
          }
        : null,
    ),
  } as unknown as WorkspaceReaderPort;

  const workspaces = {
    findBySlug: vi.fn(async () => workspace),
  } as unknown as WorkspaceRepository;

  const teams = { find: vi.fn(async () => team) } as unknown as TeamRepository;
  const lines = {
    find: vi.fn(async () => found),
  } as unknown as AssemblyLineRepository;

  const reader = {
    read: vi.fn(() => ({ plans: [], problems: [] })),
    write: vi.fn((each: AssemblyLine) => {
      rendered = each;
      return ConfigurationFile.of('.spotlight/lines/default.yml', 'rendered');
    }),
  } as unknown as LineReaderPort;

  const contents = {
    read: vi.fn(async () => branchFile),
  } as unknown as RepositoryContentsPort;

  const writing = {
    write: vi.fn(async () => ({ url: 'https://github.com/acme/api/pull/9' })),
  } as unknown as WriteConfiguration;

  const target = {
    of: vi.fn(async () => ({
      installation: GitHubInstallation.of('42'),
      repository: Repository.of('acme/api'),
    })),
  } as unknown as ConfigurationTarget;

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerPort;

  const service = new ProposeLineChange(
    workspaces,
    members,
    teams,
    lines,
    reader,
    contents,
    target,
    writing,
    { generate: () => 'id_1' },
    logger,
  );

  const rename = () =>
    service.propose({
      teamId: 'team_1',
      viewerId: 'user_1',
      lineId: 'line_1',
      change: (base) =>
        base.renameStation(StationId.of('station_1'), StationName.of('Intake')),
      describe: () => ({
        title: 'Update Spotlight configuration',
        body: 'body',
      }),
    });

  return { service, rename, writing, contents, rendered: () => rendered };
};

describe('ProposeLineChange', () => {
  it('writes the edited line to the configuration branch as a pull request', async () => {
    const p = proposing();

    await expect(p.rename()).resolves.toEqual({
      url: 'https://github.com/acme/api/pull/9',
    });
    expect(p.writing.write).toHaveBeenCalledWith(
      workspace,
      team,
      expect.objectContaining({ branch: 'spotlight/configuration' }),
    );
    expect(p.rendered()?.stationAt(StationId.of('station_1'))?.name.value).toBe(
      'Intake',
    );
  });

  // The rolling pull request is the base, so an edit lands on top of one not
  // yet merged rather than re-rendering from the board.
  it('reads the line from the configuration branch before editing it', async () => {
    const p = proposing();

    await p.rename();

    expect(p.contents.read).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'spotlight/configuration',
        path: '.spotlight/lines/default.yml',
      }),
    );
  });

  it('says nothing where the caller is no member of the team', async () => {
    const p = proposing(line(), null, null);

    await expect(p.rename()).resolves.toBeNull();
  });

  it('refuses where the line does not exist', async () => {
    await expect(proposing(null).rename()).rejects.toThrow(
      UnknownAssemblyLineError,
    );
  });
});
