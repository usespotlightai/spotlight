import type { DeliveryBacklog } from '@platform/events/delivery-backlog';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { OutboxTeamProvisioning } from '@work/infrastructure/events/outbox-team-provisioning';
import { describe, expect, it, vi } from 'vitest';

const provisioning = (pending: number, deadLettered: number) => {
  const pendingDeliveriesFor = vi
    .fn()
    .mockResolvedValue({ pending, deadLettered });

  return {
    pendingDeliveriesFor,
    read: new OutboxTeamProvisioning({
      pendingDeliveriesFor,
    } as unknown as DeliveryBacklog).of(TeamId.of('team_1')),
  };
};

describe('OutboxTeamProvisioning', () => {
  it('reads as done once no delivery is pending', async () => {
    await expect(provisioning(0, 0).read).resolves.toBe('done');
  });

  it('reads as pending while the setup still has pending deliveries, retries included', async () => {
    await expect(provisioning(1, 0).read).resolves.toBe('pending');
  });

  it('reads as failed once a delivery is dead-lettered', async () => {
    await expect(provisioning(1, 1).read).resolves.toBe('failed');
  });

  it('asks only about a team a person signed up with', async () => {
    const { pendingDeliveriesFor, read } = provisioning(0, 0);

    await read;

    expect(pendingDeliveriesFor).toHaveBeenCalledWith('work.provision-team', {
      teamId: 'team_1',
      origin: 'sign-up',
    });
  });
});
