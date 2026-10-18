import type {
  WorkspaceAccessPort,
  WorkspacePermissions,
} from '@identity/application/ports/workspace-access.port';
import { DeleteHostHandler } from '@runners/application/commands/handlers/delete-host.handler';
import { DeleteHostCommand } from '@runners/application/commands/host.commands';
import {
  aHost,
  HOST_ID,
  storedHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const forgetting = (
  permissions: Partial<WorkspacePermissions> | null = {
    slug: 'acme',
    managesRunners: true,
  },
) => {
  const host = aHost();
  const { stored, hosts } = storedHosts(host);
  const handler = new DeleteHostHandler(
    {
      permissionsIn: vi.fn(async () =>
        permissions ? { workspaceId: host.workspaceId, ...permissions } : null,
      ),
    } as unknown as WorkspaceAccessPort,
    hosts,
  );

  return {
    stored,
    hosts,
    forget: (hostId = HOST_ID.value) =>
      handler.execute(
        new DeleteHostCommand('acme', hostId, actorFor().principal),
      ),
  };
};

describe('DeleteHostHandler', () => {
  it('deletes a host of the workspace for someone who manages runners', async () => {
    const { forget, stored } = forgetting();

    await expect(forget()).resolves.toEqual({ outcome: 'deleted' });
    expect(stored.size).toBe(0);
  });

  it('deletes a host that reported again while it was deleted', async () => {
    const { forget, hosts, stored } = forgetting();
    hosts.remove.mockImplementationOnce(async () => {
      throw new RunnerHostVersionConflictError(HOST_ID.value);
    });

    await expect(forget()).resolves.toEqual({ outcome: 'deleted' });
    expect(hosts.remove).toHaveBeenCalledTimes(2);
    expect(stored.size).toBe(0);
  });

  it('refuses someone who does not manage runners', async () => {
    const { forget, hosts } = forgetting({
      slug: 'acme',
      managesRunners: false,
    });

    await expect(forget()).resolves.toEqual({
      outcome: 'forbidden',
      act: 'runners',
    });
    expect(hosts.remove).not.toHaveBeenCalled();
  });

  it('finds no host of another workspace', async () => {
    const { forget, hosts } = forgetting({
      slug: 'other',
      managesRunners: true,
    });

    await expect(forget()).resolves.toBeNull();
    expect(hosts.remove).not.toHaveBeenCalled();
  });

  it('finds no host for someone outside its workspace', async () => {
    await expect(forgetting(null).forget()).resolves.toBeNull();
  });

  it('finds no host it never heard from', async () => {
    await expect(
      forgetting().forget('01J8ZQ4Y7N3K5V2W9X6RTBHCDF'),
    ).resolves.toBeNull();
  });
});
