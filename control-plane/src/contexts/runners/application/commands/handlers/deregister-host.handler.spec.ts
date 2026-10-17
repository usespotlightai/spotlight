import { DeregisterHostHandler } from '@runners/application/commands/handlers/deregister-host.handler';
import { DeregisterHostCommand } from '@runners/application/commands/host.commands';
import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aHost,
  aPullPool,
  aTrust,
  HOST_ID,
  storedHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { describe, expect, it, vi } from 'vitest';

const deregistering = (admitted: RunnerPool | RunnerTrust | null) => {
  const { stored, hosts } = storedHosts(aHost({ through: aPullPool() }));
  const handler = new DeregisterHostHandler(
    {
      admit: vi.fn(async () =>
        admitted
          ? {
              way: Admission.through(admitted.id),
              workspaceId: admitted.workspaceId,
            }
          : null,
      ),
    } satisfies RunnerAdmissionsPort,
    hosts,
  );

  return {
    stored,
    hosts,
    deregister: () =>
      handler.execute(
        new DeregisterHostCommand(
          { bearer: 'pool-token', trust: undefined },
          HOST_ID.value,
        ),
      ),
  };
};

describe('DeregisterHostHandler', () => {
  it('removes a host that deregisters through the way it came in', async () => {
    const { deregister, hosts, stored } = deregistering(aPullPool());

    await expect(deregister()).resolves.toEqual({ outcome: 'deregistered' });
    expect(hosts.remove.mock.calls[0]?.[0].id.equals(HOST_ID)).toBe(true);
    expect(stored.size).toBe(0);
  });

  it('removes nothing of a host served through another way, yet lets it deregister', async () => {
    const { deregister, hosts } = deregistering(aTrust());

    await expect(deregister()).resolves.toEqual({ outcome: 'deregistered' });
    expect(hosts.remove).not.toHaveBeenCalled();
  });

  it('removes a host that sent a heartbeat again while it deregistered', async () => {
    const { deregister, hosts, stored } = deregistering(aPullPool());
    hosts.remove.mockImplementationOnce(async () => {
      throw new RunnerHostVersionConflictError(HOST_ID.value);
    });

    await expect(deregister()).resolves.toEqual({ outcome: 'deregistered' });
    expect(hosts.remove).toHaveBeenCalledTimes(2);
    expect(stored.size).toBe(0);
  });

  it('deregisters when the host was removed while it deregistered', async () => {
    const { deregister, hosts, stored } = deregistering(aPullPool());
    hosts.remove.mockImplementationOnce(async () => {
      stored.clear();
      throw new RunnerHostVersionConflictError(HOST_ID.value);
    });

    await expect(deregister()).resolves.toEqual({ outcome: 'deregistered' });
    expect(hosts.remove).toHaveBeenCalledTimes(1);
  });

  it('deregisters and changes nothing when the host is already removed', async () => {
    const { deregister, hosts, stored } = deregistering(aPullPool());
    stored.clear();

    await expect(deregister()).resolves.toEqual({ outcome: 'deregistered' });
    expect(hosts.remove).not.toHaveBeenCalled();
  });

  it('does not accept a host no pool or trust admits', async () => {
    const { deregister, hosts } = deregistering(null);

    await expect(deregister()).resolves.toEqual({ outcome: 'unauthorized' });
    expect(hosts.remove).not.toHaveBeenCalled();
  });
});
