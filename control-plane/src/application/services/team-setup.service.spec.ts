import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import {
  asSetupState,
  TeamSetup,
} from '@application/services/team-setup.service';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('123e4567-e89b-42d3-a456-426614174000');
const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

type Given = {
  connected?: boolean;
  runner?: boolean;
  applied?: boolean;
  listening?: readonly string[];
  configRepository?: string | null;
};

const read = (given: Given = {}) => {
  const connections = {
    connectionTo: vi
      .fn()
      .mockResolvedValue(
        given.connected ? Connection.of(GitHubInstallation.SOURCE, '42') : null,
      ),
  } as unknown as WorkspaceConnections;

  const configurations = {
    findFor: vi
      .fn()
      .mockResolvedValue(given.applied ? { under: () => [] } : null),
  } as unknown as TeamConfigurationRepository;

  const integrations = {
    read: vi.fn().mockReturnValue({
      integrations: (given.listening ?? []).map((source) => ({
        source: { value: source },
      })),
      problems: [],
    }),
  } as unknown as IntegrationReaderPort;

  const runners = {
    anyConnected: vi.fn().mockResolvedValue(given.runner ?? false),
  } as unknown as RunnerReaderPort;

  const teams = {
    find: vi
      .fn()
      .mockResolvedValue(
        given.configRepository
          ? { configRepository: { value: given.configRepository } }
          : null,
      ),
  } as unknown as TeamRepository;

  return new TeamSetup(
    connections,
    configurations,
    integrations,
    runners,
    teams,
  ).factsFor(WORKSPACE, TEAM);
};

describe('TeamSetup', () => {
  it('says a team that has done nothing has done nothing', async () => {
    await expect(read()).resolves.toEqual({
      hasRunner: false,
      connectedToGitHub: false,
      installation: null,
      configRepository: null,
      hasConfiguration: false,
      listening: [],
    });
  });

  it('reads back where a team stands', async () => {
    await expect(
      read({
        connected: true,
        runner: true,
        applied: true,
        listening: ['linear'],
        configRepository: 'acme/spotlight-config',
      }),
    ).resolves.toEqual({
      hasRunner: true,
      connectedToGitHub: true,
      installation: GitHubInstallation.of('42'),
      configRepository: 'acme/spotlight-config',
      hasConfiguration: true,
      listening: ['linear'],
    });
  });

  // A row is not a machine, whether never reached or taken away.
  it('has no runner where nothing has checked in', async () => {
    await expect(read({ runner: false })).resolves.toMatchObject({
      hasRunner: false,
    });
  });

  it('hears no tools while no configuration has been taken up', async () => {
    await expect(read({ listening: ['linear'] })).resolves.toMatchObject({
      listening: [],
    });
  });
});

describe('asSetupState', () => {
  it('answers the list in the terms it counts in', () => {
    expect(
      asSetupState({
        hasRunner: true,
        connectedToGitHub: true,
        installation: GitHubInstallation.of('42'),
        configRepository: 'acme/spotlight-config',
        hasConfiguration: true,
        listening: ['linear'],
      }),
    ).toEqual({
      hasRunner: true,
      connectedToGitHub: true,
      hasRepository: true,
      hasConfiguration: true,
      listensToATool: true,
    });
  });

  it('has neither where a team pinned nothing and listens to nothing', () => {
    expect(
      asSetupState({
        hasRunner: false,
        connectedToGitHub: false,
        installation: null,
        configRepository: null,
        hasConfiguration: false,
        listening: [],
      }),
    ).toMatchObject({ hasRepository: false, listensToATool: false });
  });
});
