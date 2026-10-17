import { OutboxWorkspaceProvisioning } from '@identity/infrastructure/events/outbox-workspace-provisioning';
import type { DeliveryBacklog } from '@platform/events/delivery-backlog';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const provisioning = (pending: number, deadLettered: number) => {
  const pendingDeliveriesFor = vi
    .fn()
    .mockResolvedValue({ pending, deadLettered });

  return {
    pendingDeliveriesFor,
    read: new OutboxWorkspaceProvisioning({
      pendingDeliveriesFor,
    } as unknown as DeliveryBacklog).of(WorkspaceId.of('ws_1')),
  };
};

describe('OutboxWorkspaceProvisioning', () => {
  it('reads as done once the first team exists', async () => {
    await expect(provisioning(0, 0).read).resolves.toBe('done');
  });

  it('reads as pending while the first team still has pending deliveries, retries included', async () => {
    await expect(provisioning(1, 0).read).resolves.toBe('pending');
  });

  it('reads as failed once a delivery is dead-lettered', async () => {
    await expect(provisioning(1, 1).read).resolves.toBe('failed');
  });

  it('reads the first team of that workspace', async () => {
    const { pendingDeliveriesFor, read } = provisioning(0, 0);

    await read;

    expect(pendingDeliveriesFor).toHaveBeenCalledWith('identity.first-team', {
      workspaceId: 'ws_1',
    });
  });
});
