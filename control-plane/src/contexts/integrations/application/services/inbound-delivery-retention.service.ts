import { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';
import { InboundDeliveryVersionConflictError } from '@integrations/domain/exceptions/inbound-delivery-version-conflict.error';
import type { InboundDeliveryRepository } from '@integrations/domain/repositories/inbound-delivery.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const BATCH = 500;

export class InboundDeliveryRetention {
  constructor(
    private readonly deliveries: InboundDeliveryRepository,
    private readonly clock: ClockPort,
  ) {}

  async purgeFinished(): Promise<number> {
    const now = this.clock.now();
    const finished = await this.deliveries.finishedBefore(
      InboundDelivery.retentionCutoff(now),
      BATCH,
    );
    let purged = 0;

    for (const delivery of finished) {
      if (delivery.isPastRetention(now) && (await this.removed(delivery))) {
        purged += 1;
      }
    }

    return purged;
  }

  async removeAddressedTo(teamId: TeamId): Promise<void> {
    for (;;) {
      const addressed = await this.deliveries.addressedTo(teamId, BATCH);

      for (const delivery of addressed) {
        await this.deliveries.remove(delivery);
      }

      if (addressed.length < BATCH) {
        return;
      }
    }
  }

  private async removed(delivery: InboundDelivery): Promise<boolean> {
    try {
      await this.deliveries.remove(delivery);
      return true;
    } catch (error) {
      if (error instanceof InboundDeliveryVersionConflictError) {
        return false;
      }
      throw error;
    }
  }
}
