import { LeaveAsHostHandler } from '@runners/application/commands/handlers/leave-as-host.handler';
import { LeaveAsHostCommand } from '@runners/application/commands/host.commands';
import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aHost,
  aPullPool,
  aTrust,
  HOST_ID,
  heldHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { describe, expect, it, vi } from 'vitest';

const leaving = (admitted: RunnerPool | RunnerTrust | null) => {
  const { held, hosts } = heldHosts(aHost({ through: aPullPool() }));
  const handler = new LeaveAsHostHandler(
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
    held,
    hosts,
    leave: () =>
      handler.execute(
        new LeaveAsHostCommand(
          { bearer: 'pool-token', trust: undefined },
          HOST_ID.value,
        ),
      ),
  };
};

describe('LeaveAsHostHandler', () => {
  it('forgets a host that leaves through the way it came in', async () => {
    const { leave, hosts, held } = leaving(aPullPool());

    await expect(leave()).resolves.toEqual({ outcome: 'left' });
    expect(hosts.remove.mock.calls[0]?.[0].id.equals(HOST_ID)).toBe(true);
    expect(held.size).toBe(0);
  });

  it('forgets nothing of a host served through another way, yet lets it leave', async () => {
    const { leave, hosts } = leaving(aTrust());

    await expect(leave()).resolves.toEqual({ outcome: 'left' });
    expect(hosts.remove).not.toHaveBeenCalled();
  });

  it('forgets a host that reported again while it left', async () => {
    const { leave, hosts, held } = leaving(aPullPool());
    hosts.remove.mockImplementationOnce(async () => {
      throw new RunnerHostVersionConflictError(HOST_ID.value);
    });

    await expect(leave()).resolves.toEqual({ outcome: 'left' });
    expect(hosts.remove).toHaveBeenCalledTimes(2);
    expect(held.size).toBe(0);
  });

  it('leaves when the host was forgotten while it left', async () => {
    const { leave, hosts, held } = leaving(aPullPool());
    hosts.remove.mockImplementationOnce(async () => {
      held.clear();
      throw new RunnerHostVersionConflictError(HOST_ID.value);
    });

    await expect(leave()).resolves.toEqual({ outcome: 'left' });
    expect(hosts.remove).toHaveBeenCalledTimes(1);
  });

  it('leaves without forgetting anything when the host is already forgotten', async () => {
    const { leave, hosts, held } = leaving(aPullPool());
    held.clear();

    await expect(leave()).resolves.toEqual({ outcome: 'left' });
    expect(hosts.remove).not.toHaveBeenCalled();
  });

  it('refuses a host no pool or trust admits', async () => {
    const { leave, hosts } = leaving(null);

    await expect(leave()).resolves.toEqual({ outcome: 'refused' });
    expect(hosts.remove).not.toHaveBeenCalled();
  });
});
