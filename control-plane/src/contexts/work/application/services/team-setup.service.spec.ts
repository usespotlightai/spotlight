import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ConfigurationStatusPort } from '@work/application/ports/configuration-status.port';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';
import {
  asSetupState,
  TeamSetup,
} from '@work/application/services/team-setup.service';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('123e4567-e89b-42d3-a456-426614174000');
const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

type Given = {
  connected?: boolean;
  runner?: boolean;
  applied?: boolean;
  listening?: readonly string[];
};

const read = (given: Given = {}) => {
  const connections = {
    isConnected: vi.fn().mockResolvedValue(given.connected ?? false),
  } as unknown as WorkspaceConnectionsPort;

  const configurations = {
    isApplied: vi.fn().mockResolvedValue(given.applied ?? false),
  } satisfies ConfigurationStatusPort;

  const integrations = {
    offered: vi.fn(),
    listening: vi.fn().mockResolvedValue(given.listening ?? []),
  } satisfies TeamIntegrationsPort;

  const runners = {
    anyConnected: vi.fn().mockResolvedValue(given.runner ?? false),
  } as unknown as RunnerReaderPort;

  return new TeamSetup(
    connections,
    configurations,
    integrations,
    runners,
  ).factsFor(WORKSPACE, TEAM);
};

describe('TeamSetup', () => {
  it('says a team that has done nothing has done nothing', async () => {
    await expect(read()).resolves.toEqual({
      hasRunner: false,
      connectedToGitHub: false,
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
      }),
    ).resolves.toEqual({
      hasRunner: true,
      connectedToGitHub: true,
      hasConfiguration: true,
      listening: ['linear'],
    });
  });

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
        hasConfiguration: true,
        listening: ['linear'],
      }),
    ).toEqual({
      hasRunner: true,
      connectedToGitHub: true,
      hasConfiguration: true,
      listensToAnIntegration: true,
    });
  });

  it('does not listen where a team listens to nothing', () => {
    expect(
      asSetupState({
        hasRunner: false,
        connectedToGitHub: false,
        hasConfiguration: false,
        listening: [],
      }),
    ).toMatchObject({ listensToAnIntegration: false });
  });
});
