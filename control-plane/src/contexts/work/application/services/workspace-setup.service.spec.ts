import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceSetup } from '@work/application/services/workspace-setup.service';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('123e4567-e89b-42d3-a456-426614174001');

type Given = {
  connected?: boolean;
  harness?: boolean;
};

const read = (given: Given = {}) => {
  const connections = {
    isConnected: vi.fn().mockResolvedValue(given.connected ?? false),
  } as unknown as WorkspaceConnectionsPort;

  const runners = {
    anyOffersWork: vi.fn().mockResolvedValue(given.harness ?? false),
  } as unknown as RunnerReaderPort;

  return new WorkspaceSetup(connections, runners).stateOf(WORKSPACE);
};

describe('WorkspaceSetup', () => {
  it('says a workspace that has done nothing has done nothing', async () => {
    await expect(read()).resolves.toEqual({
      connectedToGitHub: false,
      hasHarness: false,
    });
  });

  it('reads back where a workspace stands', async () => {
    await expect(read({ connected: true, harness: true })).resolves.toEqual({
      connectedToGitHub: true,
      hasHarness: true,
    });
  });

  it('has no harness where no runner offers work', async () => {
    await expect(
      read({ connected: true, harness: false }),
    ).resolves.toMatchObject({ hasHarness: false });
  });
});
