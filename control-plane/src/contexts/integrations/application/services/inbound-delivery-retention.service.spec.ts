import { InboundDeliveryRetention } from '@integrations/application/services/inbound-delivery-retention.service';
import { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import { InboundDeliveryId } from '@integrations/domain/value-objects/inbound-delivery-id.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-10-30T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const doneAt = (at: Date): InboundDelivery =>
  InboundDelivery.rehydrate({
    integration: IntegrationKey.of('github'),
    to: null,
    id: InboundDeliveryId.of(`d_${at.getTime()}`),
    headers: {},
    body: {},
    causeFiringId: null,
    receivedAt: at,
    progress: { kind: 'done', at },
    attempts: 1,
    failure: null,
    version: 2,
  });

const retentionOf = (deliveries: readonly InboundDelivery[]) => {
  const repository = {
    add: vi.fn(),
    claimCandidates: vi.fn(),
    current: vi.fn(),
    addressedTo: vi.fn(async () => deliveries),
    finishedBefore: vi.fn(async () => deliveries),
    save: vi.fn(),
    remove: vi.fn(async () => {}),
  } satisfies InboundDeliveryRepository;

  return {
    retention: new InboundDeliveryRetention(repository, {
      now: () => NOW,
    } as ClockPort),
    repository,
  };
};

describe('InboundDeliveryRetention', () => {
  it('removes finished deliveries kept for 30 days, and keeps younger ones', async () => {
    const old = doneAt(new Date(NOW.getTime() - 31 * DAY));
    const young = doneAt(new Date(NOW.getTime() - 2 * DAY));
    const { retention, repository } = retentionOf([old, young]);

    await expect(retention.purgeFinished()).resolves.toBe(1);

    expect(repository.remove).toHaveBeenCalledWith(old);
    expect(repository.remove).not.toHaveBeenCalledWith(young);
  });

  it('removes every delivery addressed to a deleted team', async () => {
    const delivery = doneAt(new Date(NOW.getTime() - DAY));
    const { retention, repository } = retentionOf([delivery]);

    await retention.removeAddressedTo(TeamId.of('team_1'));

    expect(repository.remove).toHaveBeenCalledWith(delivery);
  });
});
