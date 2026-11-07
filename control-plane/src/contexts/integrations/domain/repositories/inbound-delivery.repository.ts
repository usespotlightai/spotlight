import type { InboundDelivery } from '@integrations/domain/aggregates/inbound-delivery.aggregate';

export const INBOUND_DELIVERIES = Symbol('INBOUND_DELIVERIES');

export interface InboundDeliveryRepository {
  add(delivery: InboundDelivery): Promise<boolean>;

  // Must be atomic: two workers must never have a lease on the same delivery.
  claimNext(now: Date): Promise<InboundDelivery | null>;

  save(delivery: InboundDelivery): Promise<void>;
}
